#[macro_use]
extern crate serde_derive;

use std::fs;
use std::fs::File;
use std::io::prelude::*;

extern crate byteorder;

use byteorder::{BigEndian, WriteBytesExt};

mod dictionary;

const DIRECTIONS: &[&str] = &["io-en", "en-io", "io-ru-io"];

fn main() {
    for &dir in DIRECTIONS.iter() {
        let data =
            dictionary::load_dictionary("service_data/dictionaries_by_letter/".to_owned() + dir);

        let target_path = "misc_data/stardict/".to_owned() + dir;
        fs::remove_dir_all(&target_path).unwrap();
        fs::create_dir_all(&target_path).unwrap();

        let mut dict_file_stream =
            File::create(target_path.to_owned() + "/" + dir + ".dict").unwrap();

        let mut idx_data = vec![];
        let mut offset = 0;
        for article in data.entries {
            let bytes = article.as_bytes();
            dict_file_stream.write_all(bytes).unwrap();
            idx_data.push((offset, bytes.len()));
            offset += bytes.len();
        }

        let mut idx_file_stream =
            File::create(target_path.to_owned() + "/" + dir + ".idx").unwrap();
        let mut all_words: Vec<String> = data.compact_index.keys().map(|x| x.clone()).collect();
        // Emulate g_ascii_strcasecmp
        all_words.sort_by_key(|x| {
            x.bytes()
                .map(|x| if x >= 128 { 0 } else { x })
                .collect::<Vec<u8>>()
        });
        let mut idx_size = 0;
        for word in &all_words {
            let article_ids = &data.compact_index[word];
            for article_id in article_ids {
                let word_bytes = word.as_bytes();
                idx_file_stream.write_all(word_bytes).unwrap();
                idx_file_stream.write_all(&vec![0u8]).unwrap();
                idx_file_stream
                    .write_i32::<BigEndian>(idx_data[*article_id].0 as i32)
                    .unwrap();
                idx_file_stream
                    .write_i32::<BigEndian>(idx_data[*article_id].1 as i32)
                    .unwrap();
                idx_size += word_bytes.len() + 9;
            }
        }
        let mut ifo_file_writer =
            File::create(target_path.to_owned() + "/" + dir + ".ifo").unwrap();
        ifo_file_writer
            .write_all(
                format!(
                    "StarDict's dict ifo file
version=3.0.0
[options]
bookname={}
wordcount={}
idxfilesize={}
sametypesequence=h
",
                    dir,
                    all_words.len(),
                    idx_size
                ).as_bytes(),
            )
            .unwrap();
    }
}
