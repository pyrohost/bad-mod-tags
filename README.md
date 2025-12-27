<h1><img src=".github/assets/logo.svg" height="28" style="vertical-align: middle; margin-bottom: 4px;"> Bad Mod Tags</h1>

A community database of Minecraft mods with incorrect client/server compatibility tags on CurseForge and Modrinth.

Mislabeled mods cause real problems. Client-only mods marked as server-compatible can crash servers or waste resources, while server-required mods marked as client-only lead to failed connections. This database provides the correct tags so launchers and modpack tools can handle these mods properly.

## API

Base URL: `https://pyrohost.github.io/bad-mod-tags/api/v1/`

| Endpoint                | Description             |
| ----------------------- | ----------------------- |
| `/mods.json`            | Full database           |
| `/stats.json`           | Statistics              |
| `/modrinth/{id}.json`   | Lookup by Modrinth ID   |
| `/curseforge/{id}.json` | Lookup by CurseForge ID |

### Example

```bash
curl https://pyrohost.github.io/bad-mod-tags/api/v1/modrinth/sodium.json
```

```json
{
  "name": "Sodium",
  "modrinth_id": "sodium",
  "curseforge_id": 394468,
  "correct_tags": { "client": "required", "server": "unsupported" },
  "recommendation": { "client": true, "server": false }
}
```

### Environment Tags

| Value         | Meaning                           |
| ------------- | --------------------------------- |
| `required`    | Must be installed on this side    |
| `optional`    | Can be installed but not required |
| `unsupported` | Should not be installed           |

## Contributing

Found a mod with incorrect tags? [Open an issue](https://github.com/pyrohost/bad-mod-tags/issues/new?template=report-mod.yml) and a PR will be automatically created for review.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

This project is maintained by [Pyro Inc.](https://pyro.host/) and made possible by the open-source community.
