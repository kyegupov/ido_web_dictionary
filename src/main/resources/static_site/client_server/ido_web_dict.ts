/// <reference path="jquery.d.ts" />


class SearchResponse {
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
                $.get(`api/search?lang=${this.dir}&query=${query}`,
                    jsonResponse => {
                        if (this.timestampOfLastCompletedRequest == null
                            || this.timestampOfLastCompletedRequest < timestampRequestStarted) {
                            this.display_results(jsonResponse as SearchResponse)
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

    display_results(searchResponse: SearchResponse) {

        let linksHtml : string[] = [];
        if (searchResponse.suggestions) {
            for (let word of searchResponse.suggestions) {
                linksHtml.push("<b>" + IdoDictionaryUi.make_link(word) + "</b>");
            }
        } else {
            IdoDictionaryUi.fade_articles();
        }
        let wordsHtml = linksHtml.join(" · ");

        if (searchResponse.totalSuggestions > searchResponse.suggestions.length) {
            wordsHtml += "... " + searchResponse.totalSuggestions + " matching words found";
        }

        if (!wordsHtml) {
            wordsHtml = "No matching words found";
        }
        $("#words")[0].innerHTML = wordsHtml;

        $("#content")[0].innerHTML = searchResponse.articlesHtml.join("<hr>");

        $("a.suggested_word").click(event => {
            $("#searchbox").val(event.target.textContent!);
            this.refresh_wordlist(true);
        });

        IdoDictionaryUi.unfade_articles();
        $("b[fullkey~='" + this.queryAsAlreadyProcessed +"']").addClass("red");
    }

}


var app = new IdoDictionaryUi();

$(document).ready(() => app.main());
