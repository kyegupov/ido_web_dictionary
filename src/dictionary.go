package main

import "fmt"
import "bufio"
import "os"
import "strings"
import "io/ioutil"
import "sort"

import "golang.org/x/net/html"

type DictionaryOfStringArticles struct {
	Entries      []string
	CompactIndex []IndexEntry // should be sorted by words
}

type IndexEntry struct {
	word       string
	articleIds []int
}

func (d DictionaryOfStringArticles) FindCeiling(word string) int {
	return sort.Search(len(d.CompactIndex), func(i int) bool {
		fmt.Println(d.CompactIndex[i].word, word, d.CompactIndex[i].word >= word)
		return d.CompactIndex[i].word >= word
	})
}

func LoadDictionary(path string) DictionaryOfStringArticles {
	shards, err := ioutil.ReadDir(path)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Loading data for dictionary %v, %v shards\n", path, len(shards))

	articles := make([]string, 0)

	for _, shard := range shards {
		file, err := os.Open(path + "/" + shard.Name())
		if err != nil {
			panic(err)
		}
		scanner := bufio.NewScanner(file)
		accumulator := make([]string, 0)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" && len(accumulator) > 0 {
				articles = append(articles, strings.Join(accumulator, " "))
				accumulator = make([]string, 0)
			} else {
				accumulator = append(accumulator, line)
			}
		}
		if len(accumulator) > 0 {
			articles = append(articles, strings.Join(accumulator, " "))
		}
	}
	index := build_index(articles)

	sort.Slice(index, func(i, j int) bool { return index[i].word < index[j].word })
	return DictionaryOfStringArticles{Entries: articles, CompactIndex: index}
}

func positionToWeight(index int, size int) float64 {
	return 1.0 - (float64(index) / float64(size))
}

type Weighted struct {
	index  int
	weight float64
}

func build_index(articles []string) []IndexEntry {
	index_with_weights := map[string][]Weighted{}

	for article_index, entry := range articles {
		doc := html.NewTokenizer(strings.NewReader(entry))
		keywords := []string{}

		iterating := true
		for iterating {
			tt := doc.Next()
			switch {
			case tt == html.ErrorToken:
				iterating = false
			case tt == html.StartTagToken:
				t := doc.Token()
				for _, a := range t.Attr {
					if a.Key == "dict-key" {
						keywords = append(keywords, strings.Split(a.Val, ",")...)
						break
					}
				}
			}
		}

		for kw_index, kw := range keywords {
			weight := positionToWeight(kw_index, len(keywords))
			entry, exists := index_with_weights[kw]
			if !exists {
				entry = []Weighted{}
			}
			index_with_weights[kw] = append(entry, Weighted{article_index, weight})
		}
	}

	compact_index := make([]IndexEntry, 0, len(articles))

	for key, weighted_entry_indices := range index_with_weights {
		// reverse sort
		sort.Slice(weighted_entry_indices,
			func(i, j int) bool { return weighted_entry_indices[j].weight < weighted_entry_indices[i].weight })
		indices := []int{}
		for _, w := range weighted_entry_indices {
			indices = append(indices, w.index)
		}
		compact_index = append(compact_index, IndexEntry{strings.ToLower(key), indices})
	}

	return compact_index
}
