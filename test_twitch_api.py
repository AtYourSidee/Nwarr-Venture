import urllib.request
import json

url = 'https://gql.twitch.tv/gql'
headers = {
    'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
    'Content-Type': 'application/json'
}
query = [{
    'operationName': 'StreamMetadataByLogin',
    'variables': {'login': 'luidjy_skyblex'},
    'query': 'query StreamMetadataByLogin($login: String!) { user(login: $login) { displayName profileImageURL(width: 70) stream { id title type viewersCount game { displayName } } } }'
}]
req = urllib.request.Request(url, data=json.dumps(query).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        print('status', resp.status)
        print(resp.read().decode())
except Exception as e:
    print('error', e)
