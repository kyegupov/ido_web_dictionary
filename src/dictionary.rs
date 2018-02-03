extern crate select;

extern crate serde;

use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::io::BufRead;
use std::path::PathBuf;

use self::select::document::Document;
use self::select::predicate::Attr;

pub struct DictionaryOfStringArticles {
    pub entries: Vec<String>,
    pub compact_index: BTreeMap<String, Vec<usize>>
}

pub fn load_dictionary(path: String) -> DictionaryOfStringArticles {
    let mut shards: Vec<PathBuf> = fs::read_dir(&path).unwrap().map(|x|x.unwrap().path()).collect();
    shards.sort();
    println!("Loading data for dictionary {}, {} shards", path, shards.len());

    let mut articles: Vec<String> = vec![];

    for shard in shards {
        let mut f = BufReader::new(File::open(shard).unwrap());
        let mut accumulator = String::new();
        for line_res in f.lines() {
            let line = line_res.unwrap();
            if line == "" && accumulator != "" {
                articles.push(accumulator);
                accumulator = String::new();
            } else {
                if accumulator != "" {
                    accumulator.push_str(" ");
                }
                accumulator.push_str(&line);
            }
        }
        if accumulator != "" {
            articles.push(accumulator);
        }
    }
    let index = build_index(&articles);
    return DictionaryOfStringArticles{entries: articles, compact_index: index}
}

fn position_to_weight(index: usize, size: usize) -> f64 {
    return 1.0 - (index as f64 / size as f64)
}

fn build_index(articles: &Vec<String>) -> BTreeMap<String, Vec<usize>> {
    let mut index_with_weights: BTreeMap<String, Vec<(usize, f64)>> = BTreeMap::new();

    for (article_index, entry) in articles.iter().enumerate() {
        let html = Document::from(&entry as &str);
        let keywords: Vec<&str> = 
            html.find(Attr("dict-key", ())).flat_map(|node| node.attr("dict-key").unwrap().split(',')).collect();

        for (kw_index, &kw) in keywords.iter().enumerate() {
            let weight = position_to_weight(kw_index, keywords.len());
            index_with_weights.entry(kw.to_owned()).or_insert_with(|| Vec::new()).push((article_index, weight));
        }
    }
    let mut compact_index: BTreeMap<String, Vec<usize>> = BTreeMap::new();
    for (key, weighted_entry_indices) in index_with_weights.iter_mut() {
        weighted_entry_indices.sort_by(|a,b|a.partial_cmp(b).unwrap());
        compact_index.insert(key.to_lowercase(), weighted_entry_indices.iter().map(|x|x.0).collect());
    }

    return compact_index
}