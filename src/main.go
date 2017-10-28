package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

var DIRECTIONS = []string{"io-en", "en-io", "io-ru-io"}

var languageToDirections = map[string][]string{
	"en": []string{"en-io", "io-en"},
	"ru": []string{"io-ru-io"},
}

func loadDictionaries() map[string]DictionaryOfStringArticles {
	result := map[string]DictionaryOfStringArticles{}
	for _, dir := range DIRECTIONS {
		path := "backend/src/main/resources/dictionaries_by_letter/" + dir
		result[dir] = LoadDictionary(path)
	}
	return result
}

type PerLanguageSearchResponse struct {
	Suggestions      []string `json:"suggestions"`
	TotalSuggestions int      `json:"totalSuggestions"`
	ArticlesHtml     []string `json:"articlesHtml"`
}

type Normalization struct {
	endings          []string
	normalizedEnding string
}

var ENDING_NORMALIZATION = []Normalization{
	Normalization{[]string{"i", "on", "in"}, "o"},
	Normalization{
		[]string{
			"as", "is", "os",
			"us", "ez",
			"ir", "or",
			"anta", "inta", "onta",
			"ata", "ita", "ota",
		},
		"ar"},
}

func normalizeIdoWord(word string) string {
	for _, pair := range ENDING_NORMALIZATION {
		for _, endingInflected := range pair.endings {
			if strings.HasSuffix(word, endingInflected) {
				return strings.TrimSuffix(word, endingInflected) + pair.normalizedEnding
			}
		}
	}
	return word
}

var language_to_directions = map[string][]string{
	"en": []string{"en-io", "io-en"},
	"ru": []string{"io-ru-io"},
}

func main() {

	dictionaries := loadDictionaries()

	http.HandleFunc("/api/search", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("query")
		result := map[string]PerLanguageSearchResponse{}
		language := r.URL.Query().Get("lang")
		for _, direction := range languageToDirections[language] {
			dic := dictionaries[direction]
			suggestedWords := []IndexEntry{}

			for i := dic.FindCeiling(query); i < len(dic.CompactIndex) && strings.HasPrefix(dic.CompactIndex[i].word, query); i++ {
				suggestedWords = append(suggestedWords, dic.CompactIndex[i])
			}
			if strings.Contains(direction, "io-") {
				nquery := normalizeIdoWord(query)
				for i := dic.FindCeiling(nquery); i < len(dic.CompactIndex) && strings.HasPrefix(dic.CompactIndex[i].word, nquery); i++ {
					suggestedWords = append(suggestedWords, dic.CompactIndex[i])
				}
			}
			preciseArticleIds := []int{}
			if len(suggestedWords) > 0 && (suggestedWords[0].word == query || len(suggestedWords) == 1) {
				preciseArticleIds = append(preciseArticleIds, suggestedWords[0].articleIds...)
			}
			suggestions := []string{}
			if len(suggestedWords) < 100 {
				for i, entry := range suggestedWords {
					if i >= 30 {
						break
					}
					suggestions = append(suggestions, entry.word)
				}
			}
			articlesHtml := make([]string, 0, len(preciseArticleIds))
			for _, id := range preciseArticleIds {
				articlesHtml = append(articlesHtml, dic.Entries[id])
			}
			langResult := PerLanguageSearchResponse{
				Suggestions:      suggestions,
				TotalSuggestions: len(suggestedWords),
				ArticlesHtml:     articlesHtml,
			}
			result[direction] = langResult
		}
		js, err := json.Marshal(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(js)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "backend/src/main/resources/frontend"+r.URL.Path[1:])
	})
	http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "backend/src/main/resources/frontend"+r.URL.Path)
	})

	fmt.Printf("started\n")
	http.ListenAndServe(":3000", nil)
}
