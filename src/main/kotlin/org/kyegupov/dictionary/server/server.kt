package org.kyegupov.dictionary.server

import org.jsoup.Jsoup
import org.kyegupov.dictionary.tools.GSON
import org.kyegupov.dictionary.tools.Language
import org.kyegupov.dictionary.tools.Weighted
import org.slf4j.LoggerFactory
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor
import org.yaml.snakeyaml.representer.Representer
import spark.Request
import spark.Response
import spark.Spark
import java.io.InputStreamReader
import java.nio.file.*
import java.util.*
import java.util.stream.Collectors


data class DictionaryOfStringArticles(
        val entries: List<String>,
        val compactIndex: TreeMap<String, List<Int>>
)

data class PerLanguageSearchResponse(
        val suggestions: List<String>,
        val totalSuggestions: Int,
        val articlesHtml: List<String>
)

// Translatable word or untranslatable segment of a phase
data class PhraseWord(
        val originalWord: String,
        val normalizedWord: String? // empty if non-translatable
)

val NON_WORD_CHARS = Regex("\\b")

val ENDING_NORMALIZATION = listOf(
        Pair(listOf("i", "on", "in"), "o"),
        Pair(listOf("as", "is", "os", "us"), "ar")
)

val YAML = {
    val dumperOptions = DumperOptions()
    val representer = Representer()
    dumperOptions.isAllowReadOnlyProperties = true
    Yaml(SafeConstructor(), representer, dumperOptions)
}()

// TODO: handle adjectives without -a
private fun normalizeIdoWord(word: String): String? {
    for (pair in ENDING_NORMALIZATION) {
        for (endingInflected in pair.first) {
            if (word.endsWith(endingInflected)) {
                return word.removeSuffix(endingInflected) + pair.second
            }
        }
    }
    return word
}

val CLASS_LOADER = Thread.currentThread().contextClassLoader!!

var JAR_FS: FileSystem? = null

val LOG = LoggerFactory.getLogger("ido-web-dictionary")!!

// https://stackoverflow.com/a/28057735
fun listResources(path: String): List<Path> {
    val uri = CLASS_LOADER.getResource(path).toURI()
    val myPath: Path
    if (uri.scheme == "jar") {
        if (JAR_FS == null) {
            JAR_FS = FileSystems.newFileSystem(uri, Collections.emptyMap<String, Any>())
        }
        myPath = JAR_FS!!.getPath(path)
    } else {
        myPath = Paths.get(uri)
    }
    return Files.walk(myPath, 1).skip(1).collect(Collectors.toList())
}

fun loadDataFromAlphabetizedShards(path: String) : DictionaryOfStringArticles {
    val allArticles = mutableListOf<String>()
    for (resource in listResources(path)) {
        LOG.info("Reading shard $resource")
        Files.newInputStream(resource).use {
            val text = InputStreamReader(it).readText()
            val articles = (YAML.load(text) as List<*>).map { it as String }
            allArticles.addAll(articles)
        }
    }
    LOG.info("Building index")
    return DictionaryOfStringArticles(
            entries = allArticles,
            compactIndex = buildIndex(allArticles))
}

private fun positionToWeight(index: Int, size: Int): Double {
    return 1.0 - (1.0 * index / size)
}

fun buildIndex(articles: MutableList<String>): TreeMap<String, List<Int>> {

    val index = TreeMap<String, MutableMap<Int, Double>>()

    articles.forEachIndexed { i, entry ->
        val html = Jsoup.parse(entry)
        val keywords = html.select("[dict-key]").map {it.attr("dict-key")}
        val weightedKeywords = keywords.mapIndexed{ki, kw -> Weighted(kw, positionToWeight(ki, keywords.size))}

        weightedKeywords.forEach { (value, weight) ->
            index.getOrPut(value, {hashMapOf()}).put(i, weight)
        }
    }
    val compactIndex = TreeMap<String, List<Int>>()
    index.forEach { key, weightedEntryIndices ->
        compactIndex.put(key.toLowerCase(), weightedEntryIndices.entries.sortedBy { -it.value }.map{it.key})}

    return compactIndex
}

fun main(args: Array<String>) {
    val allLanguageCodes = mapOf(Pair("i", Language.IDO), Pair("e", Language.ENGLISH))

    val data = mutableMapOf<Language, DictionaryOfStringArticles>()

    for ((langCode, lang) in allLanguageCodes) {
        data[lang] = loadDataFromAlphabetizedShards("dyer_by_letter/$langCode")
    }

    Spark.port(3000)

    val staticPath = "static_site/client_server"

    if (CLASS_LOADER.getResource("static_site").protocol == "file") {
        // developer mode, serve from source
        Spark.staticFiles.externalLocation("src/main/resources/" + staticPath)
    } else {
        Spark.staticFiles.location(staticPath)
    }

    Spark.get("api/search", { request: Request, response: Response ->
        // TODO: support multiple non-Ido languages, get language from client
        val query = request.queryParams("query")!!
        val result = mutableMapOf<String, PerLanguageSearchResponse>()
        val queryLang = request.queryParams("lang")
        val languages = if (queryLang == null) allLanguageCodes.keys else listOf(queryLang)
        for (langCode in languages) {
            val lang = allLanguageCodes[langCode]
            val dic = data[lang]!!
            val suggestedWords: Map<String, List<Int>> = dic.compactIndex.subMap(query, query + "\uFFFF")
            val preciseArticleIds = dic.compactIndex[query] ?:
                    if (suggestedWords.size == 1) dic.compactIndex[suggestedWords.entries.first().key]!!
                    else listOf()
            val langResult = PerLanguageSearchResponse(
                    suggestions = if (suggestedWords.entries.size < 100) {
                        suggestedWords.entries.take(30).map { it.key }
                    } else listOf<String>(),
                    totalSuggestions = suggestedWords.size,
                    articlesHtml = preciseArticleIds.map { dic.entries[it] })
            result[langCode] = langResult
        }
        response.type("application/json")
        GSON.toJson(result)
    })

    Spark.get("api/phrase", { request: Request, response: Response ->
        // TODO: support multiple non-Ido languages, get language from client
        val query = request.queryParams("query")!!
        val phraseResult = mutableListOf<PhraseWord>()
        val dic = data[Language.IDO]!!
        for (word0 in query.split(NON_WORD_CHARS)) {
            val word = normalizeIdoWord(word0.toLowerCase())
            if (dic.compactIndex.containsKey(word)) {
                phraseResult.add(PhraseWord(word0, word))
            } else {
                phraseResult.add(PhraseWord(word0, null))
            }
        }
        response.type("application/json")
        GSON.toJson(phraseResult)
    })
}
