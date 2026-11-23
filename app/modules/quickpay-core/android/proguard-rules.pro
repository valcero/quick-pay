# The gomobile runtime calls these classes from native code by name; R8 must not rename or strip them.
-keep class go.** { *; }
-keep class com.quickpay.** { *; }
