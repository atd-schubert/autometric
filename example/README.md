```bash
curl -X POST -T /dev/random http://localhost:9999/compress > /dev/null
curl -X POST -T /dev/zero http://localhost:9999/compress > /dev/null &
curl -X POST -T ~/Downloads/ubuntu-16.04.4-desktop-amd64.iso  http://localhost:9999/compress > /dev/null &

```
