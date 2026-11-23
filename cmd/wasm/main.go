//go:build js && wasm

// Command wasm exposes core/bridge to the browser as globalThis.quickpay.
// Each function returns {ok:true,value:string} or {ok:false,error:string}.
package main

import (
	"syscall/js"

	"github.com/quickpay/quickpay/core/bridge"
)

func wrap1(f func(string) (string, error)) js.Func {
	return js.FuncOf(func(_ js.Value, a []js.Value) any { return result(f(arg(a, 0))) })
}
func wrap2(f func(string, string) (string, error)) js.Func {
	return js.FuncOf(func(_ js.Value, a []js.Value) any { return result(f(arg(a, 0), arg(a, 1))) })
}
func wrap3(f func(string, string, string) (string, error)) js.Func {
	return js.FuncOf(func(_ js.Value, a []js.Value) any { return result(f(arg(a, 0), arg(a, 1), arg(a, 2))) })
}
func wrap4(f func(string, string, string, string) (string, error)) js.Func {
	return js.FuncOf(func(_ js.Value, a []js.Value) any {
		return result(f(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3)))
	})
}

func arg(a []js.Value, i int) string {
	if i < len(a) && a[i].Type() == js.TypeString {
		return a[i].String()
	}
	return ""
}

func result(v string, err error) any {
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}
	return map[string]any{"ok": true, "value": v}
}

func main() {
	api := map[string]any{
		"parseQR":           wrap1(bridge.ParseQR),
		"buildUPI":          wrap4(bridge.BuildUPI),
		"newDocument":       wrap1(func(string) (string, error) { return bridge.NewDocument() }),
		"addProfile":        wrap3(bridge.AddProfile),
		"removeProfile":     wrap2(bridge.RemoveProfile),
		"setDefaultProfile": wrap2(bridge.SetDefaultProfile),
		"renameProfile":     wrap3(bridge.RenameProfile),
		"generateKey":       wrap1(func(string) (string, error) { return bridge.GenerateKey() }),
		"deriveKey":         wrap2(bridge.DeriveKey),
		"sealDocument":      wrap2(bridge.SealDocument),
		"openDocument":      wrap2(bridge.OpenDocument),
	}
	js.Global().Set("quickpay", js.ValueOf(api))
	select {} // keep the Go runtime alive
}
