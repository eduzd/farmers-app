// Must load first: clamps the reported window width on web (see webFrame.ts).
import "@/lib/webFrame";
// Secure random values for uuid on phones (calculator records).
import "@/lib/cryptoPolyfill";
import { registerRootComponent } from "expo";

import App from "@/App";

registerRootComponent(App);
