import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
export function useIdleSession(authenticated) {
 const deadline=useQuery(api.sessions.current,authenticated?{}:"skip");
 const touch=useMutation(api.sessions.touch);
 const {signOut}=useAuthActions();
 const [locked,setLocked]=useState(false);
 useEffect(()=>{if(authenticated) void touch().catch(()=>{setLocked(true);void signOut().catch(()=>{});});},[authenticated,touch,signOut]);
 useEffect(()=>{
  if(!authenticated) {setLocked(false);return;}
  if(deadline===undefined) return;
  let stopped=false, pending=false, lastSent=0;
  const lock=()=>{if(stopped)return;stopped=true;setLocked(true);void signOut().catch(()=>{});};
  if(deadline===null || Date.now()>=deadline){lock();return;}
  const timer=setTimeout(lock,Math.max(0,deadline-Date.now()));
  const activity=(event)=>{
   if(Date.now()>=deadline){lock();return;}
   if(!event.isTrusted || document.visibilityState!=="visible" || pending || Date.now()-lastSent<15000) return;
   pending=true;lastSent=Date.now();void touch().catch(lock).finally(()=>{pending=false;});
  };
  const check=()=>{if(Date.now()>=deadline)lock();};
  const events=["pointerdown","keydown","wheel","touchstart"];
  events.forEach(name=>window.addEventListener(name,activity,{passive:true}));
  window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);
  return ()=>{stopped=true;clearTimeout(timer);events.forEach(name=>window.removeEventListener(name,activity));window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
 },[authenticated,deadline,touch,signOut]);
 return {ready:authenticated && deadline!==undefined && deadline!==null && Date.now()<deadline && !locked,locked};
}
