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


class IdoDictionaryUi {
    queryAsAlreadyProcessed: string = ""; // previous query
    wordToHighlight: string = "";
    mode: "single_word" | "ido_phrase";
    delayedRequestHandle: number;
    timestampOfLastCompletedRequest: number | null;

    main() {
        this.queryAsAlreadyProcessed = "";

        $("input:radio[name=search-type]").change((event) => {
            this.mode = $(event.target).val();
            if (this.mode == "single_word") {
                $(".phrase").hide();
            } else {
                $(".phrase").show();
            }
            this.handleSearchBoxChange();
        });
        $("#searchbox").on("input", () => {
            this.handleSearchBoxChange();
        });
        $("input:radio[name=search-type][value=single_word]").click();
        this.mode = "single_word";
    }

    handleSearchBoxChange() {
        let query = $("#searchbox").val().trim();
        if (query.trim() == "") {
            $("#banner").show();
            $(".results").hide();
        }
        if (query != this.queryAsAlreadyProcessed && query!="") {
            if (this.mode == "single_word") {
                this.searchWord(query.toLowerCase(), false, null);
            } else {
                this.searchPhrase(query, false);
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

    searchWord(query: string, immediately: boolean, language: string | null) {
        let url = `api/search?query=${query}`;
        if (language != null) {
            url += `&lang=${language}`;
        }
        let wordQuery = query;

        this.setupServerRequest(url,
            jsonResponse => this.displayResults(wordQuery, jsonResponse as SearchResponse),
            immediately);
    }

    searchPhrase(query: string, immediately: boolean) {

        this.setupServerRequest(`api/phrase?query=${query}`,
            jsonResponse => this.displayPhraseResults(jsonResponse as PhraseWord[]),
            immediately);
    }

    // TODO: HTML sanitizing

    static makeSearchLink(keyword) {
        return '<a href="#" class="suggested_word">' + keyword + "</a>";
    }

    private static makeQuickSearchLink(word: PhraseWord) {
        return `<a href="#" class="suggested_phrase_word" keyword="${word.normalizedWord}">` + word.originalWord + "</a>";
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

        let r1 = IdoDictionaryUi.displayLanguageResults(searchResponse.e, "en-io");
        let r2 = IdoDictionaryUi.displayLanguageResults(searchResponse.i, "io-en");

        if (!r1 && !r2) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        } else {
            $(".nope").hide();
        }

        if (r1 && r2) {
            $("#separator").show();
        } else {
            $("#separator").hide();
        }

        $("a.suggested_word").click(event => {
            $("#searchbox").val(event.target.textContent!);
            this.handleSearchBoxChange();
        });

        IdoDictionaryUi.unfadeResults();

        $("b[fullkey~='" + wordQuery +"']").addClass("red");
    }

    static displayLanguageResults(langSearchResponse: PerLanguageSearchResponse, langCode: string): boolean{

        let linksHtml : string[] = [];

        if (!langSearchResponse || langSearchResponse.totalSuggestions == 0) {
            $(`.${langCode}`).hide();
            return false;
        }

        if (langSearchResponse.suggestions) {
            for (let word of langSearchResponse.suggestions) {
                linksHtml.push("<b>" + IdoDictionaryUi.makeSearchLink(word) + "</b>");
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

        $(`.${langCode} .words`)[0].innerHTML = wordsHtml;

        $(`.${langCode} .articles`)[0].innerHTML = langSearchResponse.articlesHtml.join("<hr>");

        $(`.${langCode}`).show();
        return true;
    }

    private displayPhraseResults(words: PhraseWord[]) {
        if (!words) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        } else {
            $(".nope").hide();
            IdoDictionaryUi.unfadeResults();
        }

        let linksHtml : string[] = [];

        for (let word of words) {
            if (word.normalizedWord) {
                linksHtml.push("<b>" + IdoDictionaryUi.makeQuickSearchLink(word) + "</b>");
            } else {
                linksHtml.push(word.originalWord);
            }
        }
        $(".phrase").html(linksHtml.join(""));

        $("a.suggested_phrase_word").click(event => {
            this.searchWord(event.target.getAttribute("keyword")!, true, "i");
        });
    }
}


let app = new IdoDictionaryUi();

$(document).ready(() => app.main());
