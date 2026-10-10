import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { useAppHistoryValue } from "../src/utils/appHistory";
function Fixture() {
  const role = new URLSearchParams(window.location.search).get("role") || "cleaner";
  const [view, setView] = useAppHistoryValue("view", "Cleaner Portal", "test-workspace");
  const [calendar, setCalendar] = useAppHistoryValue("calendar");
  const [day, setDay] = useAppHistoryValue("day");
  const [task, setTask] = useAppHistoryValue("task");
  return <main><h1>History test: {role}</h1><p>{view}</p>
    {["Cleaner Profile", "Shared Workspaces", "Cleaner Schedule"].map(v => <button key={v} onClick={()=>setView(v)}>{v}</button>)}
    {view === "Cleaner Schedule" && <><button onClick={()=>setCalendar("1")}>Open Calendar</button>
      {calendar && <><p>Calendar open</p><button onClick={()=>setDay("2026-10-15")}>October 15</button>
        {day && <><p>Day: {day}</p><button onClick={()=>setTask("sample-task")}>Open task</button></>}
      </>}
    </>}
    {task && <section><h2>Sample task card</h2><button onClick={()=>setTask(null)}>Close task</button></section>}
    <p>No authentication or production records are used by this fixture.</p>
  </main>;
}
createRoot(document.getElementById("root")!).render(<BrowserRouter><Fixture/></BrowserRouter>);
