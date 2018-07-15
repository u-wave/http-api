# u-wave-http-api change log

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

## 0.5.0 / 15 Jul 2018

Features:
 * Pass through filter query parameter to getUsers(). (#195)
 * Add first item from the active playlist to /now response. (#205)
 * Move waitlist to u-wave-core. (#227)
 * Separate socket server from the HTTP API. (#241)

Bugfixes:
 * Fix crash in /now if user has no playlists. (#242)
 * Fix password reset validation. (#256)

Internal:
 * Use joi's builtin Promise API. (#229)
 * Do not transform object rest spread. (#197)
 * Dependency updates.

## 0.4.3 / 03 Apr 2018

Bugfixes:

 * Fix access check when removing other users from the waitlist. (#192)

## 0.4.2 / 29 Mar 2018

Bugfixes:

 * Only send ping messages if socket connection is open. (#190)

Internal:

 * Rename leftover api-v1 references to http-api.

## 0.4.1 / 22 Mar 2018

Bugfixes:

 * Pass through public errors from core. (#189)
 * Ignore incorrect JWT instead of rejecting the request. (#188)

## 0.4.0 / 18 Mar 2018

Features:

 * Use a Set to store votes. (#159)
 * sockets: Send message acknowledging authentication success. (#164)
 * Move all logic into controllers. (#120)
 * Generate cjs and es modules builds. (#168)
 * Add development server. (#171)
 * Revamp authentication. (#173)
 * Rename http-api. (d28145e4ea5066b274a361376282fa5012935d17)
 * Move signin and password change code into core. (#176)
 * Move items to end of playlist. (#178)
 * Use u-wave-core acl for protecting routes. (#114)

Bugfixes:

 * Fix /booth/favorite response format. (#184)

Internal:

 * Remove direct model usage in favour of -core API calls. (#177)
 * Remove direct websocket broadcasting from controllers. (#182)
 * Enable long stack traces in the dev server. (#183)

## 0.3.0 / 25 Aug 2017

Features:

 * Add password reset emails. (#89 by @gnowxilef)

Internal:

 * Dependency updates.

## 0.2.2 / 09 Jul 2017

Features:

 * Periodically send keepalive messages to connected sockets. (#147)
 * Add source maps. (#151)

Internal:

 * Add Node 7 and 8 to CI. (#148)

## 0.2.1 / 21 Jun 2017

Features:

 * Make email addresses case insensitive. (#139)

Bugfixes:

 * Fix history pagination links. (#141)
 * Fix errors being hidden. (#140)

## 0.2.0 / 15 Jun 2017

Features:

 * Move getting room and user history into `u-wave-core`. (#125)
 * Send socket messages to all of a user's connections. (#136)

Internal:

 * Switch to `bcryptjs` from `bcrypt`. (#128)

## 0.1.0 / 30 Dec 2016

Start tracking changes.
