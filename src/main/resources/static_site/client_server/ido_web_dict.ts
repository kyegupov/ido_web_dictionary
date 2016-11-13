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

const DELAY_REQUEST_MS = 300;


class IdoDictionaryUi {
    queryAsAlreadyProcessed: string = ""; // previous query
    dir: string; // direction of translation, either "i" or "e"
    delayedRequestHandle: number;
    timestampOfLastCompletedRequest: number | null;

    main() {
        this.queryAsAlreadyProcessed = "";

        $("input:radio[name=direction]").change((event) => {
            this.dir = $(event.target).val()[0];
            this.queryAsAlreadyProcessed = "";
            this.refresh_wordlist();
        });
        $("#searchbox").on("input", () => this.refresh_wordlist());
        $("input:radio[name=direction][value=ido-eng]").click();
    }

    refresh_wordlist(immediately: boolean = false) {
        let query = $("#searchbox").val().toLowerCase().trim();

        if (query.trim() == "") {
            $("#banner").show();
            $(".results").hide();
        }

        if (query != this.queryAsAlreadyProcessed && query!="") {
            this.queryAsAlreadyProcessed = query;
            $("b").removeClass("red");

            IdoDictionaryUi.fadeResults();
            if (this.delayedRequestHandle) {
                clearTimeout(this.delayedRequestHandle);
            }
            this.delayedRequestHandle = setTimeout(() => {
                let timestampRequestStarted = Date.now();
                $.get(`api/search?&query=${query}`,
                    jsonResponse => {
                        if (this.timestampOfLastCompletedRequest == null
                            || this.timestampOfLastCompletedRequest < timestampRequestStarted) {
                            this.displayResults(jsonResponse as SearchResponse)
                            this.timestampOfLastCompletedRequest = timestampRequestStarted;
                        }
                    });
                IdoDictionaryUi.fadeResults();
            }, immediately ? 0 : DELAY_REQUEST_MS);
            this.queryAsAlreadyProcessed = query;
        }
    }

    static makeLink(keyword) {
        return '<a href="#" class="suggested_word">' + keyword + "</a>";
    }

    static fadeResults() {
        $(".results").addClass("fade");
    }

    static unfadeResults() {
        $("#banner").hide();
        $(".results").show();
        $(".results").removeClass("fade");
    }

    displayResults(searchResponse: SearchResponse) {

        let r1 = IdoDictionaryUi.displayLanguageResults(searchResponse.e, "en-io");
        let r2 = IdoDictionaryUi.displayLanguageResults(searchResponse.i, "io-en");

        if (!r1 && !r2) {
            $(".nope")[0].innerHTML = "No matching words found";
            $(".nope").show();
        } else {
            $(".nope").hide();
        }

        if (r1 && r2) {
            $(".separator").show();
        } else {
            $(".separator").hide();
        }

        $("a.suggested_word").click(event => {
            $("#searchbox").val(event.target.textContent!);
            this.refresh_wordlist(true);
        });

        IdoDictionaryUi.unfadeResults();
        $("b[fullkey~='" + this.queryAsAlreadyProcessed +"']").addClass("red");
    }

    static displayLanguageResults(langSearchResponse: PerLanguageSearchResponse, langCode: string): boolean{

        let linksHtml : string[] = [];

        if (langSearchResponse.suggestions) {
            for (let word of langSearchResponse.suggestions) {
                linksHtml.push("<b>" + IdoDictionaryUi.makeLink(word) + "</b>");
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

        if (langSearchResponse.totalSuggestions > 0) {
            $(`.${langCode} .heading`).show();
            return true;
        } else {
            $(`.${langCode} .heading`).hide();
            return false;
        }
    }

}


let app = new IdoDictionaryUi();

$(document).ready(() => app.main());
