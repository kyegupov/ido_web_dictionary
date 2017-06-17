package org.kyegupov.dictionary.tools
import com.google.gson.GsonBuilder
import org.apache.commons.lang3.StringEscapeUtils
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.nodes.Node
import org.jsoup.nodes.TextNode
import org.kyegupov.dictionary.common.Language
import org.kyegupov.dictionary.common.Weighted
import java.nio.charset.Charset
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Paths

data class Article(
        val text: ArticleText,
        val keywords: List<Weighted<String>>
)

data class ArticleText(val nodes : MutableList<RichTextNode>) {
    fun extractWeitghtedKeys(): List<Weighted<String>> {
        return nodes
                .mapIndexed { i, node ->
                    if (node is KeywordNode) {
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
                is org.kyegupov.dictionary.tools.TextNode -> StringEscapeUtils.escapeHtml4(node.text)
                is KeywordNode -> ("""<b dict-key="${StringEscapeUtils.escapeHtml4(node.fullKeywords.joinToString(" "))}">"""
                    + "${StringEscapeUtils.escapeHtml4(node.text)}</b>")
                is ItalicNode -> "<i>" + StringEscapeUtils.escapeHtml4(node.text) + "</i>"
                else -> { throw IllegalArgumentException("Node : $node") }
            }
        }.joinToString(separator = "")
    }
}

interface RichTextNode {
    val text: String
}

data class TextNode(override val text : String) : RichTextNode
data class KeywordNode(
        override val text : String, // Original text
        val fullKeywords : List<String> // Expanded abbreviations, multiple versions
) : RichTextNode
data class ItalicNode(override val text : String) : RichTextNode

// Html tags
val BOLD = setOf("b", "strong")
val ITALIC = setOf("i", "em")
val TAGS_TO_COPY_AS_IS = setOf("font", "sub", "sup")

enum class ParserMode {
    IN_TEXT,
    IN_KEY,
    IN_ITALIC
}

val RE_PUREWORD = Regex("[A-Za-z]+")

val GSON = GsonBuilder().disableHtmlEscaping().setPrettyPrinting().create()!!

class HtmlParser (val language : Language) {
    val articleTexts: MutableList<ArticleText> = arrayListOf()
    private var currentArticleTextBuilder: ArticleText = ArticleText(arrayListOf())
    private var currentMode: ParserMode = ParserMode.IN_TEXT
    private var baseword: String? = null

    fun parseNode(parentNode: Node) {
        for (node in parentNode.childNodes()) {
            if (node is Element) {
                if (node.tagName() in BOLD) {
                    if (currentMode != ParserMode.IN_TEXT) {
                        println("Current mode is $currentMode when encountering ${node.tagName()} after entry ${articleTexts.lastOrNull()}")
                    }
                    currentMode = ParserMode.IN_KEY // Key mode has priority
                    // TODO: store and restore mode
                    parseNode(node)
                    currentMode = ParserMode.IN_TEXT
                } else if (node.tagName() in ITALIC) {
                    if (currentMode != ParserMode.IN_TEXT) {
                        println("Current mode is $currentMode when encountering ${node.tagName()} after entry ${articleTexts.lastOrNull()}")
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
                    throw Exception("Unknown tag ${node.tagName()} after entry ${articleTexts.lastOrNull()}")
                }
            } else if (node is TextNode) {
                handleText(node.text())
            }
        }
    }

    private fun handleText(text: String) {
        when (currentMode) {
            ParserMode.IN_TEXT -> currentArticleTextBuilder.nodes.add(TextNode(text))
            ParserMode.IN_KEY -> addKey(text)
            ParserMode.IN_ITALIC -> currentArticleTextBuilder.nodes.add(ItalicNode(text))
        }
    }

    private fun addKey(text: String) {
        val fullKeywords = inferFullKeyword(text)
        currentArticleTextBuilder.nodes.add(KeywordNode(text, fullKeywords))
    }

    fun nextEntry() {
        while (currentArticleTextBuilder.nodes.isNotEmpty() && currentArticleTextBuilder.nodes.first().text.trim().isEmpty()) {
            currentArticleTextBuilder.nodes.removeAt(0)
        }
        while (currentArticleTextBuilder.nodes.isNotEmpty() && currentArticleTextBuilder.nodes.last().text.trim().isEmpty()) {
            currentArticleTextBuilder.nodes.removeAt(currentArticleTextBuilder.nodes.size - 1)
        }
        if (currentArticleTextBuilder.nodes.size > 0) {
            articleTexts.add(currentArticleTextBuilder)
        }
        currentArticleTextBuilder = ArticleText(arrayListOf())
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
                if (!baseword.isNullOrEmpty()) {
                    if (language == Language.IDO) {
                        if (word.startsWith("-")) {
                            fullWord = baseword + word.substring(1)
                        }
                        fullWord = fullWord.replace("-", "")
                    } else if (language == Language.ENGLISH) {
                        baseword = baseword!!.removeSuffix(":")
                        if (word.startsWith(baseword!![0] + ".-")) {
                            fullWord = baseword + word.substring(3)
                        }
                        if (word.startsWith(baseword!![0] + ".")) {
                            fullWord = baseword + word.substring(2)
                        }
                        if (word.startsWith("-") && word.length > 1) {
                            var trimmedBaseword :String = baseword!!.replace(Regex("[aeiouy]$"), "").removeSuffix(word[1].toString())
                            fullWord = trimmedBaseword + word.removeSuffix(":").removePrefix("-")
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
        val articles: List<Article>
)

fun parseFiles(language: Language): ParsingResults {

    val pathMatcher = FileSystems.getDefault().getPathMatcher("glob:**/${language.toString().toLowerCase()[0]}?.html")
    val sourceFiles = Files.list(Paths.get("src/main/resources/dyer_source")).filter { pathMatcher.matches(it) }.sorted()

    val articles = arrayListOf<Article>()

    for (f in sourceFiles) {

        val rawHtml = String(Files.readAllBytes(f), Charset.forName("UTF-8"))

        val correctedHtml = rawHtml
                .replace("\r", "")
                .replace(Regex("<b><br><br>\n"), "<br><br>\n<b>")
                .replace(Regex("<b><i>\\s*</i></b>"), " ")

        require(!correctedHtml.contains("&#"), {"entity in $f"})

        val doc = Jsoup.parse(correctedHtml)
        val paragraphs = doc.body().getElementsByTag("p")
        val entriesHtml = paragraphs[1]

        val parser = HtmlParser(language)

        parser.parseNode(entriesHtml)
        parser.nextEntry()

        val newArticles = parser.articleTexts.map {
            Article(
                    it,
                    it.extractWeitghtedKeys().sortedBy { -it.weight }
            )
        }.filter {
            if (it.keywords.isEmpty()) {
                require(it.text.renderToHtml().trim().isEmpty(), {it.text});
                println("Ignoring article with no keywords: " + it.text)
                false
            } else true
        }

        articles.addAll(newArticles)
    }


    return ParsingResults(articles)
}

