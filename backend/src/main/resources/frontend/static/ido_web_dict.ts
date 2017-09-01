/// <reference path="jquery.d.ts" />


interface SearchResponse {
    e: PerLanguageSearchResponse
    i: PerLanguageSearchResponse
}

interface PerLanguageSearchResponse {
    suggestions: string[]
    totalSuggestions: number
    articlesHtml: string[]
}

interface PhraseWord {
    originalWord: string
    normalizedWord: string | null // empty if there are no results for this word
}

const DELAY_REQUEST_MS = 300;

const BASE_TITLE = "Ido ↔ English dictionary by Dyer";

const LANG_HUMAN_NAMES = {
    "en-io": "English – Ido",
    "io-en": "Ido – English",
    "io-ru-io": "Ido – Russian"
}

class IdoDictionaryUi {
    queryAsAlreadyProcessed: string = ""; // previous query
    wordToHighlight: string = "";
    mode: "single_word" | "ido_phrase";
    delayedRequestHandle: number;
    timestampOfLastCompletedRequest: number | null;
    phrase: string | null;

    main() {
        this.queryAsAlreadyProcessed = "";

        $("select[name=mode]").change((event) => {
            this.mode = $(event.target).val();
            if (this.mode == "single_word") {
                $(".phrase").hide();
            } else {
                $(".phrase").show();
            }
            this.handleSearchBoxChange(true, true);
        });
        $("select[name=lang]").change(() => {
            this.handleSearchBoxChange(true, true);
        });
        $("#searchbox").on("input", () => {
            this.handleSearchBoxChange(true, false);
        });
        this.mode = "single_word";

        window.onpopstate = e => this.handleUrl();
        this.handleUrl();
    }

    handleSearchBoxChange(updateUrl: boolean, force: boolean) {
        let query = $("#searchbox").val().trim();
        if (query.trim() == "") {
            $("#banner").show();
            $(".results").hide();
        }
        if (force || (query != this.queryAsAlreadyProcessed && query!="")) {
            let lang = $("select[name=lang]").val();
            if (this.mode == "single_word") {
                this.phrase = null;
                this.searchWord(query.toLowerCase(), lang, false, null, updateUrl);
            } else {
                this.phrase = query;
                this.searchPhrase(query, lang, false, updateUrl);
            }
            this.queryAsAlreadyProcessed = query;
        }
    }

    setupServerRequest(url: string, callback: (jsonResponse: any) => void, immediately: boolean) {
        IdoDictionaryUi.fadeResults();
        if (this.delayedRequestHandle) {
            clearTimeout(this.delayedRequestHandle);
        }
        this.delayedRequestHandle = setTimeout(() => {
            let timestampRequestStarted = Date.now();
            $.get(url,
                jsonResponse => {
                    if (this.timestampOfLastCompletedRequest == null
                        || this.timestampOfLastCompletedRequest < timestampRequestStarted) {
                        callback(jsonResponse);
                        this.timestampOfLastCompletedRequest = timestampRequestStarted;
                    }
                });
            IdoDictionaryUi.fadeResults();
        }, immediately ? 0 : DELAY_REQUEST_MS);
    }

    searchWord(query: string, lang: string, immediately: boolean, language: string | null, updateUrl: boolean) {

        let url = `api/search?lang=${lang}&query=${query}`;
        if (language != null) {
            url += `&lang=${language}`;
        }
        let wordQuery = query;

        this.setupServerRequest(url,
            jsonResponse => {
                this.displayResults(wordQuery, jsonResponse as SearchResponse);
                let title = BASE_TITLE + ": " + query;
                if (updateUrl) {
                    window.history.pushState({word: query}, title, `#?lang=${lang}&word=` + encodeURIComponent(query));
                } else {
                    window.document.title = title;
                }
            },
            immediately);
    }

    searchPhrase(query: string, lang: string, immediately: boolean, updateUrl: boolean) {

        this.setupServerRequest(`api/phrase?lang=${lang}&query=${query}`,
            jsonResponse => {
                this.displayPhraseResults(jsonResponse as PhraseWord[]);
                let title = BASE_TITLE + ": " + query;
                if (updateUrl) {
                    window.history.pushState({phrase: query}, title, `#?lang=${lang}&phrase=` + encodeURIComponent(query));
                } else {
                    window.document.title = title;
                }
            },
            immediately);
    }

    // TODO: HTML sanitizing

    static makeSearchLink(lang, keyword) {
        return `<a href="#?lang=${lang}&word=${encodeURIComponent(keyword)}" class="suggested_word">${keyword}</a>`;
    }

    private makeQuickSearchLink(lang, word: PhraseWord) {
        return `<a href="#?lang=${lang}&phrase=${encodeURIComponent(this.phrase as string)}" class="suggested_phrase_word" `
            + `keyword="${word.normalizedWord}">` + word.originalWord + "</a>";
    }

    static fadeResults() {
        $("b").removeClass("red");
        $(".results").addClass("fade");
    }

    static unfadeResults() {
        $("#banner").hide();
        $(".results").show();
        $(".results").removeClass("fade");
    }

    displayResults(wordQuery: string, searchResponse: SearchResponse) {

        $(".per_direction_result:not(.template)").remove();
        let anyResults = false;
        for (let direction of Object.keys(searchResponse)) {
            anyResults = anyResults || IdoDictionaryUi.displayLanguageResults(searchResponse[direction], direction);
        }

        if (!anyResults) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        } else {
            $(".nope").hide();
        }

        IdoDictionaryUi.unfadeResults();

        $("*[dict-key*='" + wordQuery +"']").addClass("red");
    }

    static displayLanguageResults(langSearchResponse: PerLanguageSearchResponse, langCode: string): boolean{

        let linksHtml : string[] = [];

        if (!langSearchResponse || langSearchResponse.totalSuggestions == 0) {
            $(`.${langCode}`).hide();
            return false;
        }

        let lang = $("select[name=lang]").val();

        if (langSearchResponse.suggestions) {
            for (let word of langSearchResponse.suggestions) {
                linksHtml.push("<b>" + IdoDictionaryUi.makeSearchLink(lang, word) + "</b>");
            }
        } else {
        }
        let wordsHtml = linksHtml.join(" · ");

        if (langSearchResponse.totalSuggestions > langSearchResponse.suggestions.length) {
            if (wordsHtml) {
                wordsHtml += "... ";
            }
            wordsHtml += langSearchResponse.totalSuggestions + " matching words found";
        }

        let target = $(".per_direction_results .template").clone();
        target.appendTo($(".per_direction_results"));
        target.removeClass("template");

        target.find(".heading")[0].innerHTML = LANG_HUMAN_NAMES[langCode];
        
        target.find(".words")[0].innerHTML = wordsHtml;

        target.find(".articles")[0].innerHTML = langSearchResponse.articlesHtml.join("<hr>");

        return true;
    }

    private displayPhraseResults(words: PhraseWord[]) {
        $(".per_direction_result:not(.template)").remove();
        if (!words) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        } else {
            $(".nope").hide();
            IdoDictionaryUi.unfadeResults();
        }

        let linksHtml : string[] = [];
        let lang = $("select[name=lang]").val();

        for (let word of words) {
            if (word.normalizedWord) {
                linksHtml.push("<b>" + this.makeQuickSearchLink(lang, word) + "</b>");
            } else {
                linksHtml.push(word.originalWord);
            }
        }
        $(".phrase").html(linksHtml.join(""));

        $("a.suggested_phrase_word").click(event => {
            let lang = $("select[name=lang]").val();
            this.searchWord(event.target.getAttribute("keyword")!, lang, true, "i", false);
        });
    }

    private handleUrl() {
        let phrase = getUrlFragmentParameterByName("phrase");
        let word = getUrlFragmentParameterByName("word");
        if (phrase) {
            this.mode = "ido_phrase";
            $("#searchbox").val(phrase);
            this.handleSearchBoxChange(false, false);
        } else {
            if (word) {
                this.mode = "single_word";
                $("#searchbox").val(word);
                this.handleSearchBoxChange(false, false);
            }
        }
    }
}

// Adapted from http://stackoverflow.com/a/901144
function getUrlFragmentParameterByName(name: string) {
    let url = window.location.hash;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

let app = new IdoDictionaryUi();

$(document).ready(() => app.main());
