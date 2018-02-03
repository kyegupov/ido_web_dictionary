extern crate iron;
extern crate iron_json_response as ijr;
extern crate urlencoded;
#[macro_use] extern crate maplit;
#[macro_use] extern crate serde_derive;
extern crate serde;
extern crate staticfile;
extern crate mount;
extern crate regex;
#[macro_use] extern crate lazy_static;

use std::collections::BTreeMap;
use std::ops::Range;

use regex::Regex;
use iron::prelude::*;
use iron::Handler;
use iron::status;
use staticfile::Static;
use mount::Mount;
use std::path::Path;
use std::sync::Arc;

use urlencoded::UrlEncodedQuery;

use ijr::{JsonResponseMiddleware, JsonResponse};

mod dictionary;

struct Router {
    // Routes here are simply matched with the url path.
    routes: BTreeMap<String, Box<Handler>>
}

impl Router {
    fn new() -> Self {
        Router { routes: BTreeMap::new() }
    }

    fn add_route<H>(&mut self, path: &str, handler: H) where H: Handler {
        self.routes.insert(path.to_owned(), Box::new(handler));
    }
}

impl Handler for Router {
    fn handle(&self, req: &mut Request) -> IronResult<Response> {
        match self.routes.get(&req.url.path().join("/")) {
            Some(handler) => handler.handle(req),
            None => Ok(Response::with(status::NotFound))
        }
    }
}

// Translatable word or untranslatable segment of a phase
#[derive(Serialize, Debug)]
struct PhraseWord <'a> {
    #[serde(rename="originalWord")]
    original_word: &'a str,
    #[serde(rename="normalizedWord")]
    normalized_word: Option<String> // empty if non-translatable
}

const DIRECTIONS: &[&str] = &["io-en", "en-io", "io-ru-io"];

const ENDING_NORMALIZATION: &[(&[&str], &str)] = &[
        (&["i", "on", "in"], "o"),
        (&[
                "as", "is", "os",
                "us", "ez",
                "ir", "or",
                "anta", "inta", "onta",
                "ata", "ita", "ota"],
            "ar")
];

// TODO: handle adjectives without -a
fn normalize_ido_word(word: &str) -> String {

    for &(endings, normalized) in ENDING_NORMALIZATION.iter() {
        for ending_inflected in endings {
            if word.ends_with(ending_inflected) {
                return word.trim_right_matches(ending_inflected).to_owned() + normalized;
            }
        }
    }
    return word.to_owned()
}

#[derive(Serialize, Debug)]
struct PerLanguageSearchResponse<'a> {
    suggestions: Vec<&'a str>,
    #[serde(rename="totalSuggestions")]
    total_suggestions: usize,
    #[serde(rename="articlesHtml")]
    articles_html: Vec<&'a str>
}

struct Context {
    dictionaries: BTreeMap<String, dictionary::DictionaryOfStringArticles>
} 

fn load_dictionaries() -> BTreeMap<String, dictionary::DictionaryOfStringArticles>{
    let mut result = btreemap!{};
    for &dir in DIRECTIONS.iter() {
        let path = "service_data/dictionaries_by_letter/".to_owned() + dir;
        result.insert(dir.to_owned(), dictionary::load_dictionary(path));
    }
    result
}

lazy_static! {
    static ref NON_WORD_CHARS: Regex = Regex::new("\\b").unwrap();
}

fn main() {

    // let DIRECTIONS: Vec<&str> = vec!["io-en", "en-io", "io-ru-io"];

    let context = Arc::new(Context{dictionaries: load_dictionaries()});

    let language_to_directions: BTreeMap<&str, Vec<&str>> = btreemap!{
        "en" => vec!["en-io", "io-en"],
        "ru" => vec!["io-ru-io"]
    };

    let mut router = Router::new();

    let c1 = Arc::clone(&context);

    router.add_route("search", move |req: &mut Request| {
        let params = req.get_ref::<UrlEncodedQuery>().unwrap();
        let query = &params["query"][0];
        let mut result: BTreeMap<&str, PerLanguageSearchResponse> = BTreeMap::new();
        let language = &params["lang"][0];
        for direction in &language_to_directions[&language as &str] {
            let dic = &c1.dictionaries[&direction as &str];
            let words_prefixed_by_query : Range<String> = query.to_owned()..(query.to_owned() + "\u{ffff}");
            let mut suggested_words: Vec<&str> = dic.compact_index.range(words_prefixed_by_query)
                .map(|(k,_v)|k as &str).collect();
            if direction.contains("io-") {
                let normalized = normalize_ido_word(&query);
                suggested_words.extend(dic.compact_index.range(normalized.clone()..normalized + "\u{ffff}")
                    .map(|(k,_v)|k as &str));
            }
            let no_article_ids: Vec<usize> = vec![];
            let precise_article_ids = dic.compact_index.get(query).unwrap_or_else(||
                if suggested_words.len() == 1 {
                    dic.compact_index.get(suggested_words[0]).unwrap()
                 } else {
                    &no_article_ids
                }
            );
            let lang_result = PerLanguageSearchResponse{
                    suggestions: if suggested_words.len() < 100 {
                        suggested_words.iter().take(30).map(|x|*x).collect()
                    } else {
                        vec![]
                    },
                    total_suggestions: suggested_words.len(),
                    articles_html: precise_article_ids.iter().map(|&it| &dic.entries[it] as &str).collect()
            };
            result.insert(direction, lang_result);
        }

        let mut resp = Response::new();
        resp.set_mut(JsonResponse::json(result)).set_mut(status::Ok);
        Ok(resp)
    });



    let c2 = Arc::clone(&context);
    router.add_route("phrase", move |req: &mut Request| {

        // TODO: support multiple non-Ido languages, get language from client
        let params = req.get_ref::<UrlEncodedQuery>().unwrap();
        let query: String = params["query"][0].to_owned();

        let mut phrase_result = vec![];
        let dic = &c2.dictionaries["io-en"];
        for word0 in NON_WORD_CHARS.split(&query) {
            let word = normalize_ido_word(&word0.to_lowercase());
            if dic.compact_index.contains_key(&word) {
                phrase_result.push(PhraseWord{original_word: &word0, normalized_word: Some(word)})
            } else {
                phrase_result.push(PhraseWord{original_word: &word0, normalized_word: None})
            }
        }
        let mut resp = Response::new();
        resp.set_mut(JsonResponse::json(phrase_result)).set_mut(status::Ok);
        Ok(resp)
    });

    let mut chain = Chain::new(router);
    chain.link_after(JsonResponseMiddleware::new());
    let mut mount = Mount::new();    
    mount.mount("/", Static::new(Path::new("frontend")));
    mount.mount("/api", chain);
    Iron::new(mount).http("127.0.0.1:3000").unwrap();
}