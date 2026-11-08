"use client";

import dynamic from "next/dynamic";

// /lab/recording answers 404 to everyone off LAB_USER_IDS, and Next still sends the client modules a page imports
// with that 404. A chunk of its own keeps the recorder's code and copy out of the response hidden visitors get.
export default dynamic(() => import("./RecordingCheck"));
