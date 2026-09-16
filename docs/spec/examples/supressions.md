> The skill directs agents to install and invoke mmdc, which executes Mermaid CLI and its browser/transitive dependency tree. It provides no integrity hashes, provenance verification, lockfile requirement, sandboxing, or explicit trust boundary for those dependencies.

We don't want this because it is out of the scope for mermaid skill to control whole mmdc supply chain. We focus on version satblity only.

> The version policy pins only the 11.17.x minor line and prefers the latest available patch rather than requiring an exact version, so repeated runs can resolve different artifacts and reduce reproducibility.

We prefer using latest patch for minor version to address latest security findings.

> The setup instructs users to generate an unencrypted SSH private key with an empty passphrase, increasing impact if the key file is accessed.

Suppressing as using SSH key without password is not much less secure than using unencryped GitHub token. GitHub token stored in secret manager should be used instead.