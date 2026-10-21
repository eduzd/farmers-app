// Must load first: clamps the reported window width on web (see webFrame.ts).
import "@/lib/webFrame";
import { registerRootComponent } from "expo";

import App from "@/App";

registerRootComponent(App);
