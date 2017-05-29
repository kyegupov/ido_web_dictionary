package org.kyegupov.dictionary.tools
import com.google.gson.GsonBuilder
import org.apache.commons.lang3.StringEscapeUtils
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.nodes.Node
import org.jsoup.nodes.TextNode
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor
import org.yaml.snakeyaml.representer.Representer
import java.nio.charset.Charset
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Paths
import java.util.*

// Keys are in decreasing order of importance
data class Weighted<T>(val value: T, val weight: Double) : Comparable<Weighted<T>> {
    override fun compareTo(other: Weighted<T>): Int {
        // By descending weight
        return other.weight.compareTo(this.weight)
    }
}

data class Entry(val nodes : MutableList<EntryNode>) {
    fun extractWeitghtedKeys(): List<Weighted<String>> {
        return nodes
                .mapIndexed { i, node ->
                    if (node is KeyNode) {
                        node.fullKeywords.map { Weighted(it, positionToWeight(i, nodes.size)) }
                    } else listOf<Weighted<String>>()
                }
                .flatMap { it }
    }

    private fun positionToWeight(index: Int, size: Int): Double {
        return 1.0 - (1.0 * index / size)
    }

    fun renderToHtml(): String {
        return nodes.map { node ->
            when (node) {
                is TextEntryNode -> StringEscapeUtils.escapeHtml4(node.text)
                is KeyNode -> ("""<b fullkey="${StringEscapeUtils.escapeHtml4(node.fullKeywords.joinToString(" "))}">"""
                    + "${StringEscapeUtils.escapeHtml4(node.text)}</b>")
                is ItalicNode -> "<i>" + StringEscapeUtils.escapeHtml4(node.text) + "</i>"
                else -> { throw IllegalArgumentException("Node : $node") }
            }
        }.joinToString(separator = "")
    }
}

interface EntryNode

data class TextEntryNode(val text : String) : EntryNode
data class KeyNode(val text : String, val fullKeywords : List<String>) : EntryNode
data class ItalicNode(val text : String) : EntryNode

val BOLD = setOf("b", "strong")
val ITALIC = setOf("i", "em")
val TAGS_TO_COPY_AS_IS = setOf("font", "sub", "sup")

val YAML = {
    val dumperOptions = DumperOptions()
    dumperOptions.isAllowReadOnlyProperties = true
    Yaml(SafeConstructor(), Representer(), dumperOptions)
}()

enum class ParserMode {
    IN_TEXT,
    IN_KEY,
    IN_ITALIC
}

enum class Language {
    ENGLISH,
    IDO
}

val RE_PUREWORD = Regex("[A-Za-z]+")
val RE_ENTITY = Regex("&#([0-9]+);")

val GSON = GsonBuilder().disableHtmlEscaping().setPrettyPrinting().create()

class HtmlParser (val language : Language) {
    val entries: MutableList<Entry> = arrayListOf()
    private var currentEntryBuilder: Entry = Entry(arrayListOf())
    private var currentMode: ParserMode = ParserMode.IN_TEXT
    private var baseword: String? = null

    fun parseNode(parentNode: Node) {
        for (node in parentNode.childNodes()) {
            if (node is Element) {
                if (node.tagName() in BOLD) {
                    if (currentMode != ParserMode.IN_TEXT) {
                        println("Current mode is $currentMode when encountering ${node.tagName()} after entry ${entries.lastOrNull()}")
                    }
                    currentMode = ParserMode.IN_KEY // Key mode has priority
                    // TODO: store and restore mode
                    parseNode(node)
                    currentMode = ParserMode.IN_TEXT
                } else if (node.tagName() in ITALIC) {
                    if (currentMode != ParserMode.IN_TEXT) {
                        println("Current mode is $currentMode when encountering ${node.tagName()} after entry ${entries.lastOrNull()}")
                        // Key mode has priority
                    } else {
                        currentMode = ParserMode.IN_ITALIC
                    }
                    parseNode(node)
                    currentMode = ParserMode.IN_TEXT
                } else if (node.tagName() == "br") {
                    nextEntry()
                } else if (node.tagName() in TAGS_TO_COPY_AS_IS) {
                    handleText(node.outerHtml())
                } else {
                    throw Exception("Unknown tag ${node.tagName()} after entry ${entries.lastOrNull()}")
                }
            } else if (node is TextNode) {
                handleText(node.text())
            }
        }
    }

    private fun handleText(text: String) {
        when (currentMode) {
            ParserMode.IN_TEXT -> currentEntryBuilder.nodes.add(TextEntryNode(text))
            ParserMode.IN_KEY -> addKey(text)
            ParserMode.IN_ITALIC -> currentEntryBuilder.nodes.add(ItalicNode(text))
        }
    }

    private fun addKey(text: String) {
        val fullKeywords = inferFullKeyword(text)
        currentEntryBuilder.nodes.add(KeyNode(text, fullKeywords))
    }

    fun nextEntry() {
        if (currentEntryBuilder.nodes.size > 0) {
            entries.add(currentEntryBuilder)
        }
        currentEntryBuilder = Entry(arrayListOf())
        baseword = null
    }

    private fun inferFullKeyword(text: String): List<String> {
        val result = arrayListOf<String>()
        for (partialKey in text.replace('\n', ' ').trimEnd(':').trim().split(',').filter { it.isNotEmpty() }) {
            val words = partialKey.trim().split(' ')
            if (baseword == null && words.size == 1) {
                baseword = words[0].split('-')[0]
            }
            val fullWords = arrayListOf<String>()
            for (word in words.filter { it.isNotEmpty() }) {
                var fullWord = word
                if (language == Language.IDO) {
                    if (word.startsWith("-") && baseword != null) {
                        fullWord = baseword + word.substring(1)
                    }
                    fullWord = fullWord.replace("-", "")
                } else if (language == Language.ENGLISH) {
                    if (!baseword.isNullOrEmpty()) {
                        if (word.startsWith(baseword!![0] + ".-")) {
                            fullWord = baseword + word.substring(3)
                        }
                        if (word.startsWith(baseword!![0] + ".")) {
                            fullWord = baseword + word.substring(2)
                        }
                    }
                }
                val foundPureword = RE_PUREWORD.find(fullWord)
                if (foundPureword == null) {
                    println("Ignoring bad key word: \"$fullWord\" in text: \"$text\"")
                } else {
                    fullWords.add(foundPureword.value)
                }
            }
            if (fullWords.isNotEmpty()) {
                result.add(fullWords.joinToString(separator = " "))
            }
        }
        return result
    }
}

data class ParsingResults(
        val entries: List<Entry>,
        val compactIndex: TreeMap<String, List<Int>>
)

fun parseFiles(language: Language): ParsingResults {

    val pathMatcher = FileSystems.getDefault().getPathMatcher("glob:**/${language.toString().toLowerCase()[0]}?.html")
    val sourceFiles = Files.list(Paths.get("src/main/resources/dyer_source")).filter { pathMatcher.matches(it) }.sorted()

    val allEntries = arrayListOf<Entry>()
    val index = TreeMap<String, MutableMap<Int, Double>>()

    for (f in sourceFiles) {

        val rawHtml = String(Files.readAllBytes(f), Charset.forName("UTF-8"))

        // Legacy code to correct bad HTML entities
//        var correctedHtml = rawHtml.replace(org.yk4ever.dictionary.getRE_ENTITY, {var byte = it.groups[1]!!.value.toInt().toByte(); String(ByteArray(1, {byte}), Charset.forName("Windows-1252"))})
        var correctedHtml = rawHtml
        require(!correctedHtml.contains("&#"), {"entity in $f"})

        val doc = Jsoup.parse(correctedHtml)
        var paragraphs = doc.body().getElementsByTag("p")
        var entriesHtml = paragraphs[1]

        val parser = HtmlParser(language)

        parser.parseNode(entriesHtml)
        parser.nextEntry()
        allEntries.addAll(parser.entries)
    }

    allEntries.forEachIndexed { i, entry ->
        entry.extractWeitghtedKeys().sortedBy { it.weight }.forEach { key ->
            index.getOrPut(key.value, {hashMapOf()}).put(i, key.weight)
        }
    }

    val compactIndex = TreeMap<String, List<Int>>()

    index.forEach { key, weightedEntryIndices -> compactIndex.put(key.toLowerCase(), weightedEntryIndices.entries.sortedBy { -it.value }.map{it.key})}

    return ParsingResults(allEntries, compactIndex)
}

