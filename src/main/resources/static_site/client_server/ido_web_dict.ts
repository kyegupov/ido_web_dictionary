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
        var query = $("#searchbox").val().toLowerCase().trim();
        if (query != this.queryAsAlreadyProcessed && query!="") {
            this.queryAsAlreadyProcessed = query;
            $("b").removeClass("red");

            IdoDictionaryUi.fade_articles();
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
            }, immediately ? 0 : DELAY_REQUEST_MS);
            this.queryAsAlreadyProcessed = query;
        }
    }

    static make_link(keyword) {
        return '<a href="#" class="suggested_word">' + keyword + "</a>";
    }

    static fade_articles() {
        $("#content").addClass("fade");
    }

    static unfade_articles() {
        $("#content").removeClass("fade");
    }

    displayResults(searchResponse: SearchResponse) {

        let r1 = this.displayLanguageResults(searchResponse.e, "e");
        let r2 = this.displayLanguageResults(searchResponse.i, "i");

        if (!r1 && !r2) {
            $("#content-e")[0].innerHTML = "No matching words found";
        }

        if (r1 && r2) {
            $("#separator").show();
        } else {
            $("#separator").hide();
        }

        $("a.suggested_word").click(event => {
            $("#searchbox").val(event.target.textContent!);
            this.refresh_wordlist(true);
        });

        IdoDictionaryUi.unfade_articles();
        $("b[fullkey~='" + this.queryAsAlreadyProcessed +"']").addClass("red");
    }

    displayLanguageResults(langSearchResponse: PerLanguageSearchResponse, langCode: string): boolean{

        let linksHtml : string[] = [];

        if (langSearchResponse.suggestions) {
            for (let word of langSearchResponse.suggestions) {
                linksHtml.push("<b>" + IdoDictionaryUi.make_link(word) + "</b>");
            }
        } else {
            IdoDictionaryUi.fade_articles();
        }
        let wordsHtml = linksHtml.join(" · ");

        if (langSearchResponse.totalSuggestions > langSearchResponse.suggestions.length) {
            wordsHtml += "... " + langSearchResponse.totalSuggestions + " matching words found";
        }

        $("#words-" + langCode)[0].innerHTML = wordsHtml;

        $("#content-" + langCode)[0].innerHTML = langSearchResponse.articlesHtml.join("<hr>");

        if (langSearchResponse.totalSuggestions > 0) {
            $("#heading-" + langCode).show();
            return true;
        } else {
            $("#heading-" + langCode).hide();
        }
    }

}


var app = new IdoDictionaryUi();

$(document).ready(() => app.main());
