extern crate iron;
extern crate iron_json_response as ijr;
extern crate urlencoded;
#[macro_use] extern crate maplit;
#[macro_use] extern crate serde_derive;
extern crate serde;
extern crate staticfile;
extern crate mount;

use std::collections::BTreeMap;
use std::ops::Range;

use iron::prelude::*;
use iron::Handler;
use iron::status;
use staticfile::Static;
use mount::Mount;
use std::path::Path;

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

const DIRECTIONS: [&str; 3] = ["io-en", "en-io", "io-ru-io"];

// TODO: handle adjectives without -a
fn normalize_ido_word(word: &str) -> String {

    let ENDING_NORMALIZATION = vec![
            (vec!["i", "on", "in"], "o"),
            (vec![
                    "as", "is", "os",
                    "us", "ez",
                    "ir", "or",
                    "anta", "inta", "onta",
                    "ata", "ita", "ota"],
                "ar")
    ];
        
    for (endings, normalized) in ENDING_NORMALIZATION {
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
    totalSuggestions: usize,
    articlesHtml: Vec<&'a str>
}

fn main() {

    // let DIRECTIONS: Vec<&str> = vec!["io-en", "en-io", "io-ru-io"];

    let mut dictionaries: BTreeMap<String, dictionary::DictionaryOfStringArticles> = BTreeMap::new();

    let language_to_directions: BTreeMap<&str, Vec<&str>> = btreemap!{
        "en" => vec!["en-io", "io-en"],
        "ru" => vec!["io-ru-io"]
    };

    for &dir in DIRECTIONS.iter() {
        let path = "backend/src/main/resources/dictionaries_by_letter/".to_owned() + dir;
        dictionaries.insert(dir.to_owned(), dictionary::load_dictionary(path));
    }

    let mut router = Router::new();

    router.add_route("search", move |req: &mut Request| {
        let params = req.get_ref::<UrlEncodedQuery>().unwrap();
        let query = &params["query"][0];
        let mut result: BTreeMap<&str, PerLanguageSearchResponse> = BTreeMap::new();
        let language = &params["lang"][0];
        for direction in &language_to_directions[&language as &str] {
            println!("{}", direction);
            let dic = &dictionaries[&direction as &str];
            let words_prefixed_by_query : Range<String> = query.to_owned()..(query.to_owned() + "\u{ffff}");
            let mut suggested_words: Vec<&str> = dic.compactIndex.range(words_prefixed_by_query)
                .map(|(k,_v)|k as &str).collect();
            if direction.contains("io-") {
                let normalized = normalize_ido_word(&query);
                suggested_words.extend(dic.compactIndex.range(normalized.clone()..normalized + "\u{ffff}")
                    .map(|(k,_v)|k as &str));
            }
            let no_article_ids: Vec<usize> = vec![];
            let precise_article_ids = dic.compactIndex.get(query).unwrap_or_else(||
                if suggested_words.len() == 1 {
                    dic.compactIndex.get(suggested_words[0]).unwrap()
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
                    totalSuggestions: suggested_words.len(),
                    articlesHtml: precise_article_ids.iter().map(|&it| &dic.entries[it] as &str).collect()
            };
            result.insert(direction, lang_result);
        }

        let mut resp = Response::new();
        resp.set_mut(JsonResponse::json(result)).set_mut(status::Ok);
        Ok(resp)
    });

    router.add_route("hello/again", |_: &mut Request| {
       Ok(Response::with((status::Ok, "Hello again !")))
    });

    router.add_route("error", |_: &mut Request| {
       Ok(Response::with(status::BadRequest))
    });

    let mut chain = Chain::new(router);
    chain.link_after(JsonResponseMiddleware::new());
    let mut mount = Mount::new();    
    mount.mount("/", Static::new(Path::new("backend/src/main/resources/frontend")));
    mount.mount("/api", chain);
    Iron::new(mount).http("localhost:3000").unwrap();
}