// Builds a trimmed Java runtime with jlink so the packaged app is
// self-contained — end users need no separate JRE install.
//
// The Spring Boot jar is a classpath (non-modular) app, so we can't derive its
// module set reliably with jdeps (it can't see into BOOT-INF/lib). Instead we
// include the java.se aggregator plus the few extra JDK modules common Java
// server stacks reach for. Reliability over minimal size: this is a PoC.

import { rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const OUTPUT = 'runtime'

const MODULES = [
  'java.se', // full Java SE API (covers Spring MVC, Tomcat, Jackson, …)
  'jdk.unsupported', // sun.misc.Unsafe — used by Netty, reflection-heavy libs
  'jdk.crypto.ec', // EC cipher suites for TLS
  'jdk.crypto.cryptoki' // PKCS#11 crypto provider
].join(',')

const jlink = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'jlink') : 'jlink'

if (existsSync(OUTPUT)) rmSync(OUTPUT, { recursive: true, force: true })

execFileSync(
  jlink,
  [
    '--add-modules',
    MODULES,
    '--strip-debug',
    '--no-man-pages',
    '--no-header-files',
    '--output',
    OUTPUT
  ],
  { stdio: 'inherit' }
)

console.log(`\nCreated trimmed Java runtime in ./${OUTPUT}`)
