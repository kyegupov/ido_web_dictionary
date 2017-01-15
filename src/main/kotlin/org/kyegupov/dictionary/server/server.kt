package org.kyegupov.dictionary.server

import org.kyegupov.dictionary.tools.GSON
import org.kyegupov.dictionary.tools.Language
import java.io.InputStreamReader
import java.util.*
import spark.Request
import spark.Response
import spark.Spark

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

val ENDING_NORMALIZATION = listOf<Pair<List<String>, String>>(
        Pair(listOf("i", "on", "in"), "o"),
        Pair(listOf("as", "is", "os", "us"), "ar")
)

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

class Dummy {}
val CLASS_LOADER = Dummy::class.java.classLoader

fun main(args: Array<String>) {
    val allLanguageCodes = mapOf(Pair("i", Language.IDO), Pair("e", Language.ENGLISH))

    val data = mutableMapOf<Language, DictionaryOfStringArticles>()

    for ((langCode, lang) in allLanguageCodes)
    {
        CLASS_LOADER.getResourceAsStream("dyer_bundle/$langCode/combined.json").use {
            val reader = InputStreamReader(it);
            val dataAsJson = GSON.fromJson(reader, Map::class.java)
            val gsonMap = dataAsJson["index"] as Map<String, List<Int>>
            data[lang] = DictionaryOfStringArticles(
                    entries = dataAsJson["articles"] as List<String>,
                    compactIndex = TreeMap(gsonMap))
        }
    }

    Spark.port(3000)

    val staticPath = "static_site/client_server";

    if (CLASS_LOADER.getResource("static_site").protocol == "file") {
        // developer mode, serve from source
        Spark.staticFiles.externalLocation("src/main/resources/" + staticPath)
    } else {
        Spark.staticFiles.location(staticPath);
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
