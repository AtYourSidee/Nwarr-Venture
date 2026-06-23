const streamerLogin = 'luidjy_skyblex';
const defaultAvatar = 'static/twitchpp.png';
let lastStreamTitle = '';

const twitchLink = document.querySelector('.twitch-link');
const twitchAvatar = document.querySelector('.tw-avatar');
const twitchName = document.querySelector('.tw-name');
const twitchSub = document.querySelector('.tw-sub');
const twitchStatus = document.querySelector('.tw-status');
const liveDot = document.querySelector('.live-dot');
const liveText = document.querySelector('.live-text');
let initialAvatar = twitchAvatar?.src || defaultAvatar;

async function fetchTwitchGraphQL() {
  const query = [{
    operationName: 'StreamMetadataByLogin',
    variables: { login: streamerLogin },
    query: 'query StreamMetadataByLogin($login: String!) { user(login: $login) { displayName profileImageURL(width: 70) stream { id title type viewersCount game { displayName } } } }'
  }];

  const response = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(query)
  });

  if (!response.ok) {
    throw new Error(`GraphQL status ${response.status}`);
  }

  const json = await response.json();
  return json?.[0]?.data?.user || null;
}

async function fetchStreamStatusFallback() {
  const response = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${streamerLogin}`);
  if (!response.ok) {
    throw new Error(`Fallback status ${response.status}`);
  }
  const json = await response.json();
  const user = json?.[0] || null;
  if (user) {
    return {
      displayName: user.displayName,
      profileImageURL: user.logo,
      stream: user.stream
    };
  }
  return null;
}

function showLiveStatus(stream, user) {
  twitchLink.href = `https://twitch.tv/${streamerLogin}`;
  twitchAvatar.src = user?.profileImageURL || initialAvatar;
  twitchName.textContent = user?.displayName || streamerLogin;
  twitchSub.textContent = stream?.title || stream?.broadcastTitle || 'En Direct';
  lastStreamTitle = stream?.title || stream?.broadcastTitle || stream?.game?.displayName || 'En Direct';
  liveDot.style.background = '#ff2b2b';
  liveText.textContent = 'En Live';
  twitchStatus.classList.remove('offline');
  twitchStatus.classList.add('live');
}

function showOfflineStatus(user) {
  twitchLink.href = `https://twitch.tv/${streamerLogin}`;
  if (user?.profileImageURL) {
    twitchAvatar.src = user.profileImageURL;
  } else if (!twitchAvatar.src || twitchAvatar.src.endsWith('parchemin.png')) {
    twitchAvatar.src = initialAvatar;
  }
  twitchName.textContent = user?.displayName || streamerLogin;
  twitchSub.textContent = '';
  liveDot.style.background = '#777';
  liveText.textContent = 'Offline';
  twitchStatus.classList.remove('live');
  twitchStatus.classList.add('offline');
}

async function refreshTwitchStatus() {
  try {
    const user = await fetchTwitchGraphQL();
    const stream = user?.stream || null;
    if (stream) {
      showLiveStatus(stream, user);
    } else {
      showOfflineStatus(user);
    }
  } catch (error) {
    try {
      const fallback = await fetchStreamStatusFallback();
      if (fallback?.stream) {
        showLiveStatus(fallback.stream, fallback);
      } else {
        showOfflineStatus(fallback || { displayName: streamerLogin, profileImageURL: defaultAvatar });
      }
    } catch (fallbackError) {
      showOfflineStatus({ displayName: streamerLogin, profileImageURL: defaultAvatar });
      console.warn('Twitch status fetch failed:', error, fallbackError);
    }
  }
}

window.addEventListener('load', () => {
  if (!twitchLink || !twitchAvatar || !twitchName || !twitchSub || !twitchStatus || !liveDot || !liveText) {
    return;
  }
  refreshTwitchStatus();
  setInterval(refreshTwitchStatus, 120000);
});