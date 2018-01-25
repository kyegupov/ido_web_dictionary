use std::fs;
use std::fs::File;
use std::io::prelude::*;

use std::collections::BTreeMap;

extern crate byteorder;

use byteorder::{BigEndian, WriteBytesExt};

mod dictionary;

#[macro_use] extern crate maplit;

const DIRECTIONS: &[&str] = &["io-en", "en-io", "io-ru-io"];

fn main() {

    for &dir in DIRECTIONS.iter() {
        let data = dictionary::load_dictionary("service_data/dictionaries_by_letter/".to_owned() + dir);

        let targetPath = "misc_data/stardict/".to_owned() + dir;
        fs::remove_dir_all(&targetPath);
        fs::create_dir_all(&targetPath);

        let mut dictFileStream = File::create(targetPath.to_owned() + "/" + dir + ".dict").unwrap();

        let mut idxData = vec!{};
        let mut offset = 0;
        for article in data.entries {
            let bytes = article.as_bytes();
            dictFileStream.write_all(bytes).unwrap();
            idxData.push((offset, bytes.len()));
            offset += bytes.len();
        }

        let mut idxFileStream = File::create(targetPath.to_owned() + "/" + dir + ".idx").unwrap();
        let mut allWords: Vec<String> = data.compactIndex.keys().map(|x|x.clone()).collect();
        // Emulate g_ascii_strcasecmp
        allWords.sort_by_key(|x| x.bytes().map(|x| if x>=128 { 0 } else {x}).collect::<Vec<u8>>());
        let 
        mut idxSize = 0;
        for word in &allWords {
            let articleIds = &data.compactIndex[word];
            for articleId in articleIds {
                let wordBytes = word.as_bytes();
                idxFileStream.write_all(wordBytes).unwrap();
                idxFileStream.write_all(&vec!{0u8}).unwrap();
                idxFileStream.write_i32::<BigEndian>(idxData[*articleId].0 as i32);
                idxFileStream.write_i32::<BigEndian>(idxData[*articleId].1 as i32);
                idxSize += wordBytes.len() + 9;
            }
        }
        let mut ifoFileWriter = File::create(targetPath.to_owned() + "/" + dir + ".ifo").unwrap();
        ifoFileWriter.write_all(format!("StarDict's dict ifo file
version=3.0.0
[options]
bookname={}
wordcount={}
idxfilesize={}
sametypesequence=h
", dir, allWords.len(), idxSize).as_bytes()).unwrap();
    }
}

