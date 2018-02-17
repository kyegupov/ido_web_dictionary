extern crate select;

extern crate serde;
extern crate serde_cbor;

use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::io::BufRead;
use std::path::PathBuf;
use std::time::SystemTime;

use self::select::document::Document;
use self::select::predicate::Attr;

#[derive(Serialize, Deserialize, Debug)]
pub struct DictionaryOfStringArticles {
    pub entries: Vec<String>,
    pub compact_index: BTreeMap<String, Vec<usize>>
}

fn shards(path: &str) -> Vec<PathBuf> {
    fs::read_dir(path).unwrap().map(|x|x.unwrap().path()).filter(|x|x.extension().unwrap().to_str() == Some("txt")).collect()
}

fn shards_latest_timestamp(path: &str) -> SystemTime {
    shards(path).iter().map(|x|fs::metadata(x).unwrap().modified().unwrap()).max().unwrap()
}

pub fn load_dictionary(path: String) -> DictionaryOfStringArticles {
    let all_cbor = path.clone() + ".cached.cbor";
    let maybe_metadata = fs::metadata(&all_cbor);
    let needs_update = match maybe_metadata {
        Ok(meta) => meta.modified().unwrap() < shards_latest_timestamp(&path),
        Err(_) => true
    };
    if needs_update {
        let parsed = parse_from_txt(path);
        serde_cbor::to_writer(&mut File::create(all_cbor).unwrap(), &parsed).unwrap();
        return parsed;
    } else {
        println!("Loading data for dictionary {}, from pre-parsed CBOR", path);
        return serde_cbor::from_reader(File::open(all_cbor).unwrap()).unwrap();
    }
}

pub fn parse_from_txt(path: String) -> DictionaryOfStringArticles {
    let mut shards: Vec<PathBuf> = shards(&path);
    shards.sort();
    println!("Loading data for dictionary {}, from {} text shards", path, shards.len());

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