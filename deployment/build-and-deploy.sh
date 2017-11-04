# Builds and deploys the current version of the service.
#
# Before running this, install ido_dictionary.service via systemd
# and configure your nginx as per excerpt

# Run this from root of the repository

git pull
cargo build --release
mkdir -p /opt/ido_web_dictionary/
cp target/release/ido_web_dictionary /opt/ido_web_dictionary/
chmod go+rx -R /opt/ido_web_dictionary/
systemctl restart ido_dictionary

