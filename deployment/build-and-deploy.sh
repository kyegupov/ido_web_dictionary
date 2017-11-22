# Builds and deploys the current version of the service.
#
# This assumes writable /opt/
#
# Before running this, install ido_dictionary.service:
#
#   sudo cp deployment/ido_dictionary.service /etc/systemd/system/
#
# and configure your nginx as per nginx.conf.excerpt

# Run this from root of the repository

git pull
cargo build --release
mkdir -p /opt/ido_web_dictionary/
cp target/release/ido_web_dictionary /opt/ido_web_dictionary/
mkdir -p /opt/ido_web_dictionary/backend/src/main/resources/
cp -r backend/src/main/resources/* /opt/ido_web_dictionary/backend/src/main/resources/*
chmod go+rx -R /opt/ido_web_dictionary/
systemctl restart ido_dictionary

