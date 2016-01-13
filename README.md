# u-wave-api-v1

REST API plugin for your own üWave server.

## Getting Started

For now, do this:

```
git clone git@github.com:goto-bus-stop/u-wave-api-v1.git
cd u-wave-api-v1
npm install
npm run build
# This will add a "global" link to the plugin, so it'll be easy to use in other
# packages (u-wave-server, u-wave-web) during development:
npm link
```

No worries, once we're public & on NPM, you'll be able to do this instead!
:smile:

```
npm install u-wave-api-v1
```

[TODO docs on like, actually using it, and not just installing]

## Contributing

### Building

The build step compiles the futuristic JavaScript that's used in this repository
to code that can be used in engines today, using Babel. To compile the code,
run:

```
npm run build
```

Note that you have to do this again every time you make a change to any
JavaScript file. It's a bit inconvenient--hopefully we can add NPM scripts for
commands/tools that make this easier :)

## License

[MIT](./LICENSE)
