package org.kyegupov.dictionary.server

import org.kyegupov.dictionary.common.*
import org.kyegupov.dictionary.tools.GSON
import spark.Request
import spark.Response
import spark.Spark


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
        Pair(listOf("as", "is", "os", "us", "ez", "ir", "or"), "ar")
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

fun main(args: Array<String>) {

    val data = mutableMapOf<Language, DictionaryOfStringArticles>()

    for ((langCode, lang) in allLanguageCodes) {
        data[lang] = loadDataFromAlphabetizedShards("dyer_by_letter/$langCode")
    }

    Spark.port(3000)

    val staticPath = "frontend"

    if (CLASS_LOADER.getResource("frontend").protocol == "file") {
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
            val suggestedWords = mutableMapOf<String, List<Int>>()
            suggestedWords.putAll(dic.compactIndex.subMap(query, query + "\uFFFF"))
            if (lang == Language.IDO) {
                suggestedWords.putAll(dic.compactIndex.subMap(normalizeIdoWord(query), normalizeIdoWord(query)+ "\uFFFF"))
            }
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
