package expo.modules.quickpaycore

import com.quickpay.bridge.Bridge
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Exposes the Go core (core/bridge, built with gomobile) to JavaScript.
 * Same names and string/JSON contract as the Go package, so app/src/core/index.native.ts
 * is a thin adapter. Calls are synchronous: each is a tiny in-memory operation.
 */
class QuickPayCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QuickPayCore")

    Function("parseQR") { payload: String -> Bridge.parseQR(payload) }
    Function("newDocument") { -> Bridge.newDocument() }
    Function("addProfile") { doc: String, label: String, payload: String -> Bridge.addProfile(doc, label, payload) }
    Function("removeProfile") { doc: String, id: String -> Bridge.removeProfile(doc, id) }
    Function("setDefaultProfile") { doc: String, id: String -> Bridge.setDefaultProfile(doc, id) }
    Function("renameProfile") { doc: String, id: String, label: String -> Bridge.renameProfile(doc, id, label) }
    Function("generateKey") { -> Bridge.generateKey() }
    Function("deriveKey") { passphrase: String, salt: String -> Bridge.deriveKey(passphrase, salt) }
    Function("sealDocument") { keyHex: String, doc: String -> Bridge.sealDocument(keyHex, doc) }
    Function("openDocument") { keyHex: String, sealed: String -> Bridge.openDocument(keyHex, sealed) }
  }
}
