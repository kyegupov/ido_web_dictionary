package main.kotlin

import org.w3c.dom.Element
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.asList
import org.w3c.dom.events.Event
import org.w3c.xhr.XMLHttpRequest
import kotlin.browser.document
import kotlin.browser.window
import kotlin.dom.addClass
import kotlin.dom.removeClass
import kotlin.js.Date
import kotlin.js.RegExp

interface SearchResponse {
    val e: PerLanguageSearchResponse
    val i: PerLanguageSearchResponse
}

interface PerLanguageSearchResponse {
    val suggestions: List<String>
    val totalSuggestions: Int
    val articlesHtml: List<Int>
}

interface PhraseWord {
    val originalWord: String
    val normalizedWord: String? // empty if there are no results for this word
}

val DELAY_REQUEST_MS = 300

val BASE_TITLE = "Ido ↔ English dictionary by Dyer"

enum class Mode {
    single_word,
    ido_phrase
}


// Jquery / web compat
fun el(query: String): Element {
    return document.querySelector(query)!!
}

fun els(query: String): List<Element> {
    return document.querySelectorAll(query).asList().map { it as Element }
}

private fun Element.hide() {
    this.addClass("hidden")
}

private fun Element.show() {
    this.removeClass("hidden")
}

external fun encodeURIComponent(s: String): String
external fun decodeURIComponent(s: String): String

private fun Element.click() {
    this.dispatchEvent(org.w3c.dom.events.MouseEvent("click"))
}

private fun Element.click(callback: (Event) -> Unit) {
    this.addEventListener("click", callback)
}

private fun ajaxGet(url: String, callback: (dynamic) -> Unit) {
    val xhr = XMLHttpRequest()
    xhr.open("GET", url, true)
    xhr.onreadystatechange = {
        val DONE = 4 as Short
        val OK = 200 as Short
        if (xhr.readyState == DONE) {
            if (xhr.status == OK)
                callback(xhr.response!!)
        } else {
            console.log("Error: " + xhr.status)
        }
    }
    xhr.send()
}

inline fun <reified T> Any.asTyped(): T {
    T.meta
}


class IdoDictionaryUi {
    var queryAsAlreadyProcessed: String = "" // previous query
    var mode: Mode = Mode.single_word
    var delayedRequestHandle: Int? = null
    var timestampOfLastCompletedRequest: Double? = null
    var phrase: String? = null

    fun main() {
        this.queryAsAlreadyProcessed = ""

        el("input[type=radio][name=search-type][value=single_word]").setAttribute("checked", "checked")
        el("input[type=radio][name=search-type]").addEventListener("change", {event ->
            val target = event.target as Element
            this.mode = Mode.valueOf(target.getAttribute("value")!!)
            if (this.mode == Mode.single_word) {
                el(".phrase").hide()
            } else {
                el(".phrase").hide()
            }
            this.handleSearchBoxChange(true)
        })
        
        
        el("#searchbox").addEventListener("change", {
            this.handleSearchBoxChange(true)
        })

        window.onpopstate = {this.handleUrl()}
        this.handleUrl()
    }

    fun handleSearchBoxChange(updateUrl: Boolean) {
        val query = (el("#searchbox") as HTMLInputElement).value.trim()
        if (query == "") {
            el("#banner").show()
            el(".results").hide()
        }
        if (query != this.queryAsAlreadyProcessed && query!="") {
            val title = BASE_TITLE + ": " + query
            if (this.mode == Mode.single_word) {
                if (updateUrl) {
                    window.history.pushState(mapOf("word" to query),
                            title, "#?word=" + encodeURIComponent(query))
                } else {
                    window.document.title = title
                }
                this.phrase = null
                this.searchWord(query.toLowerCase(), false, null)
            } else {
                if (updateUrl) {
                    window.history.pushState(mapOf("phrase" to query),
                            title, "#?phrase=" + encodeURIComponent(query))

                } else {
                    window.document.title = title
                }
                this.phrase = query
                this.searchPhrase(query, false)
            }
            this.queryAsAlreadyProcessed = query
        }
    }

    fun setupServerRequest(url: String, callback: (jsonResponse: dynamic) -> Unit, immediately: Boolean) {
        IdoDictionaryUi.fadeResults()
        if (this.delayedRequestHandle != null) {
            window.clearTimeout(this.delayedRequestHandle!!)
        }
        this.delayedRequestHandle = window.setTimeout({
            val timestampRequestStarted : Double = Date().getTime()
            ajaxGet(url, { jsonResponse ->
                console.log(jsonResponse);
                if (this.timestampOfLastCompletedRequest == null
                    || this.timestampOfLastCompletedRequest!! < timestampRequestStarted) {
                callback(jsonResponse)
                this.timestampOfLastCompletedRequest = timestampRequestStarted
            }
        })
            IdoDictionaryUi.fadeResults()
        }, if (immediately) {0} else DELAY_REQUEST_MS)
    }


    fun searchWord(query: String, immediately: Boolean, language: String?) {

        var url = "api/search?query=${query}"
        if (language != null) {
            url += "&lang=${language}"
        }
        val wordQuery = query

        this.setupServerRequest(url,
                {jsonResponse -> this.displayResults(wordQuery, jsonResponse as SearchResponse)},
                immediately)
    }

    fun searchPhrase(query: String, immediately: Boolean) {

        this.setupServerRequest("api/phrase?query=${query}",
                {jsonResponse -> this.displayPhraseResults(jsonResponse as List<PhraseWord>)},
        immediately)
    }

    fun makeQuickSearchLink(word: PhraseWord): String {
        return ("<a href=\"#?phrase=${encodeURIComponent(this.phrase as String)}\" class=\"suggested_phrase_word\" "
        + "keyword=\"${word.normalizedWord}\">${word.originalWord}</a>")
    }

    // TODO: HTML sanitizing
    
    companion object Static {

        fun makeSearchLink(keyword: String): String {
            return "<a href=\"#?word=${encodeURIComponent(keyword)}\" class=\"suggested_word\">${keyword}</a>"
        }
    

        fun fadeResults() {
            els("b").forEach { it.removeClass("red") }
            els(".results").forEach { it.addClass("fade") }
        }
    
        fun unfadeResults() {
            el("#banner").hide()
            els(".results").forEach { it.show() }
            els(".results").forEach { it.removeClass("fade") }
        }

        fun displayLanguageResults(langSearchResponse: PerLanguageSearchResponse?, langCode: String): Boolean{

            val linksHtml = mutableListOf<String>()

            if (langSearchResponse == null || langSearchResponse.totalSuggestions > 0) {
                el(".${langCode}").hide()
                return false
            }

            if (langSearchResponse.suggestions.isNotEmpty()) {
                for (word in langSearchResponse.suggestions) {
                    linksHtml.add("<b>" + IdoDictionaryUi.makeSearchLink(word) + "</b>")
                }
            } else {
            }
            var wordsHtml = linksHtml.joinToString(" · ")

            if (langSearchResponse.totalSuggestions > langSearchResponse.suggestions.size) {
                if (wordsHtml.isNotEmpty()) {
                    wordsHtml += "... "
                }
                wordsHtml += "${langSearchResponse.totalSuggestions} matching words found"
            }

            el(".$langCode .words").innerHTML = wordsHtml

            el(".$langCode .articles").innerHTML = langSearchResponse.articlesHtml.joinToString("<hr>")

            el(".$langCode").show()
            return true
        }
    }

    fun displayResults(wordQuery: String, searchResponse: SearchResponse) {

        val r1 = IdoDictionaryUi.displayLanguageResults(searchResponse.e, "en-io")
        val r2 = IdoDictionaryUi.displayLanguageResults(searchResponse.i, "io-en")

        if (!r1 && !r2) {
            el(".nope").innerHTML = "No matching words found"
            el(".nope").show()
        } else {
            el(".nope").hide()
        }

        if (r1 && r2) {
            el("#separator").show()
        } else {
            el("#separator").hide()
        }

        IdoDictionaryUi.unfadeResults()

        el("b[dict-key~='" + wordQuery +"']").addClass("red")
    }



    fun displayPhraseResults(words: List<PhraseWord>) {
        if (words.isEmpty()) {
            el(".nope").innerHTML = "No matching words found"
            el(".nope").show()
        } else {
            el(".nope").hide()
            el(".en-io").hide()
            el(".io-en").hide()
            IdoDictionaryUi.unfadeResults()
        }

        val linksHtml = mutableListOf<String>()

        for (word in words) {
            if (word.normalizedWord != null) {
                linksHtml.add("<b>" + this.makeQuickSearchLink(word) + "</b>")
            } else {
                linksHtml.add(word.originalWord)
            }
        }
        el(".phrase").innerHTML = linksHtml.joinToString("")

        els("a.suggested_phrase_word").forEach {
            it.click({ event: Event ->
                val target = event.target as Element
                this.searchWord(target.getAttribute("keyword")!!, true, "i")
            })
        }
    }

    fun handleUrl() {
        val phrase = getUrlFragmentParameterByName("phrase")
        val word = getUrlFragmentParameterByName("word")
        if (!phrase.isNullOrEmpty()) {
            el("input[type=radio][name=search-type][value=ido_phrase]").click()
            (el("#searchbox") as HTMLInputElement).value = phrase!!
            this.handleSearchBoxChange(false)
        } else {
            if (!word.isNullOrEmpty()) {
                el("input[type=radio][name=search-type][value=single_word]").click()
                (el("#searchbox") as HTMLInputElement).value = word!!
                this.handleSearchBoxChange(false)
            }
        }
    }
}


// Adapted from http://stackoverflow.com/a/901144
fun getUrlFragmentParameterByName(name0: String): String? {
    val url = window.location.hash
    val name = name0.replace("[", "\\[").replace("]", "\\]")
    val regex = RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)")
    val results = regex.exec(url) ?: return null
    if (results[2].isNullOrEmpty()) return ""
    return decodeURIComponent(results[2]!!.replace('+', ' '))
}

val app = IdoDictionaryUi()

fun main(args: Array<String>) {
    document.addEventListener("DOMContentLoaded", { app.main()})
}
