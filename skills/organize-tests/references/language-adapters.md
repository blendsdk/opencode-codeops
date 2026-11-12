# Language Adapter Recipes

> **CodeOps Artifact Schema**: 1

The selector core is language-neutral. Each adapter is only a discovery method
and an argv command stored in the map. Never add a language branch to the core.

| Ecosystem | Natural unit | Discovery | Subset command |
| --- | --- | --- | --- |
| Node `node --test` | test file | file globs | `node --test {tests}` |
| Vitest | test file | config/project | `npx vitest run {tests}` |
| Jest | test file | config | `npx jest --runTestsByPath {tests}` |
| Rust | crate or target | `cargo metadata` | `cargo test -p <crate> --lib --tests` |
| Python | file or node ID | `pytest --collect-only` | `python3 -m pytest {tests}` |
| Go | package | `go list ./...` | `go test ./pkg/...` |
| JVM | class or package | Gradle/Maven tasks | `./gradlew test --tests com.example.core.*` |
| .NET | project or class | `dotnet test --list-tests` | `dotnet test --filter FullyQualifiedName~Core` |
| C/C++ | binary or target | `ctest -N`, Bazel query | `ctest -R ^core_`, Bazel target |
| Ruby | file | runner config | `rspec {files}` |
| PHP | file | runner config | `phpunit {files}` |
| Custom | project unit | project command | project argv |

## Target-based groups

Rust unit tests are inline in source, Go tests are package-level, and C/C++
tests are binary/target-level. These runners discover their own unit, so a
target-based group may omit `tests`. Ownership is then validated through
`sources` plus a smoke run of the command; the group is exempt from file-glob
ownership checks.

A target-based command must still prove a nonzero test count. The preview records
that count.

## File-based groups

Node, Vitest, Jest, Python, Ruby, and PHP groups use `tests` globs. `{tests}`
expands to every file the group owns, independent of the change set. A
source-only change therefore still runs the group's whole test set.

## Custom adapter

Use `--custom` when no recipe fits. Ask for both commands:

- the full verify command;
- the subset command, as argv tokens, with `{tests}` where file paths belong.

Run the subset once and record the count. If the command cannot run a subset,
keep the project on the full gate; do not invent a selector.

## Cross-language projects

Use one fragment per ecosystem and a shared `policy.json`. The full command may
be a single umbrella script or an array of argv commands. Never let one
ecosystem's group command run another ecosystem's suite.
