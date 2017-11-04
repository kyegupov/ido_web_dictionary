# Builds and deploys the current version of the service.
#
# Before running this, install ido_dictionary.service via " "
# and configure your nginx as per excerpt

# Run this from root of the repository

git pull
cargo build --release
mkdir -p /opt/ido_web_dictionary/
cp target/release/ido_web_dictionary /opt/ido_web_dictionary/
mkdir -p /opt/ido_web_dictionary/backend/src/main/resources/dictionaries_by_letter/
cp -r backend/src/main/resources/dictionaries_by_letter/* /opt/ido_web_dictionary/backend/src/main/resources/dictionaries_by_letter/*
chmod go+rx -R /opt/ido_web_dictionary/
systemctl restart ido_dictionary

