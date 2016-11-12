package org.kyegupov.dictionary.server

import org.jetbrains.ktor.application.*
import org.jetbrains.ktor.content.TextContent
import org.jetbrains.ktor.content.resolveClasspathWithPath
import org.jetbrains.ktor.content.serveClasspathResources
import org.jetbrains.ktor.features.http.DefaultHeaders
import org.jetbrains.ktor.features.install
import org.jetbrains.ktor.http.ContentType
import org.jetbrains.ktor.jetty.embeddedJettyServer
import org.jetbrains.ktor.logging.CallLogging
import org.jetbrains.ktor.logging.SLF4JApplicationLog
import org.jetbrains.ktor.routing.get
import org.jetbrains.ktor.routing.route
import org.jetbrains.ktor.routing.routing
import org.kyegupov.dictionary.tools.GSON
import org.kyegupov.dictionary.tools.Language
import java.io.InputStreamReader
import java.util.*

data class DictionaryOfStringArticles(
        val entries: List<String>,
        val compactIndex: TreeMap<String, List<Int>>
)

data class PerLanguageSearchResponse(
        val suggestions: List<String>,
        val totalSuggestions: Int,
        val articlesHtml: List<String>
)


fun ApplicationCall.respondJson(value: Any): Nothing {
    respond(TextContent(ContentType.Application.Json, GSON.toJson(value)))
}


class JsonApplication(environment: ApplicationEnvironment) : Application(environment) {

    init {
        install(DefaultHeaders)
        install(CallLogging)

        val languageCodes = mapOf(Pair("i", Language.IDO), Pair("e", Language.ENGLISH))

        val data = mutableMapOf<Language, DictionaryOfStringArticles>()

        for ((langCode, lang) in languageCodes)
        {
            this.javaClass.classLoader.getResourceAsStream("dyer_bundle/$langCode/combined.json").use {
                val reader = InputStreamReader(it);
                val dataAsJson = GSON.fromJson(reader, Map::class.java)
                val gsonMap = dataAsJson["index"] as Map<String, List<Int>>
                data[lang] = DictionaryOfStringArticles(
                        entries = dataAsJson["articles"] as List<String>,
                        compactIndex = TreeMap(gsonMap))
            }
        }

        routing {

            get("api/search") {
                // TODO: support multiple non-Ido languages, get language from client
                val result = mutableMapOf<String, PerLanguageSearchResponse>()
                for ((langCode, lang) in languageCodes) {
                    val dic = data[lang]!!
                    val query = call.request.queryParameters["query"]
                    val suggestedWords: Map<String, List<Int>> = dic.compactIndex.subMap(query, query + "\uFFFF")
                    val preciseArticleIds = dic.compactIndex[query] ?:
                            if (suggestedWords.size == 1) dic.compactIndex[suggestedWords.entries.first().key]!!
                            else listOf()
                    val langResult = PerLanguageSearchResponse(
                            suggestions = if (suggestedWords.entries.size < 50)
                            { suggestedWords.entries.map { it.key } }
                            else listOf<String>(),
                            totalSuggestions = suggestedWords.size,
                            articlesHtml = preciseArticleIds.map { dic.entries[it] })
                    result[langCode] = langResult
                }

                call.respondJson(result)
            }

            route("/static/") {
                serveClasspathResources("static_site/client_server")
            }
            route("/") {
                handle {
                    call.resolveClasspathWithPath("static_site/client_server", "index.html")?.let {
                        call.respond(it)
                    }
                }
            }
        }
    }
}

fun main(args: Array<String>) {
    // TODO: ktor turned out to be a bad choice of framework - overcomplicated internals, buggy, poorly documented,
    // developer-unfriendly.
    // If the situation does not improve drastically after next (post-0.2.2) release, consider switching to:
    // Wasabi, Kara, SparkFramework, Dropwizard
    embeddedJettyServer(3000,
            application = JsonApplication(applicationEnvironment { log = SLF4JApplicationLog("ktor") }))
            .start()
}
