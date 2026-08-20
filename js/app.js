import { auth, db, storage } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut,
  onAuthStateChanged, updateProfile, reauthenticateWithCredential,
  EmailAuthProvider, deleteUser
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot, addDoc,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const $ = id => document.getElementById(id);
const views = ["landingView","homeView","authView","dashboardView"];
let role = null;
let currentUser = null;
let unsubscribeJobs = null;
let unsubscribeApplications = null;

const show = id => views.forEach(v => $(v).classList.toggle("hidden", v !== id));
const toast = msg => { const t=$("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3000); };
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const initials = s => String(s||"JS").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();

$("startBtn").onclick = async () => { show("homeView"); await loadPublicStats(); };
document.querySelectorAll("[data-role]").forEach(b=>b.onclick=()=>openAuth(b.dataset.role));
document.querySelectorAll("[data-action='go-home']").forEach(b=>b.onclick=()=>{show("homeView");loadPublicStats();});
$("toggleRegister").onclick=()=>toggleAuthMode(true);
$("forgotBtn").onclick=forgotPassword;
document.querySelector("[data-close-modal]").onclick=()=>$("jobModal").classList.add("hidden");

function openAuth(r){
  role=r; show("authView"); toggleAuthMode(false);
  $("authTitle").textContent = r==="seeker" ? "Job Seeker Login" : "Job Provider Login";
  $("authSubtitle").textContent = r==="seeker" ? "Sign in to search and apply for jobs." : "Sign in to manage your vacancies.";
  $("providerFields").classList.toggle("hidden",r!=="provider");
  $("seekerFields").classList.toggle("hidden",r!=="seeker");
}
function toggleAuthMode(register){
  $("loginForm").classList.toggle("hidden",register);
  $("registerForm").classList.toggle("hidden",!register);
  $("toggleRegister").textContent=register?"Back to login":"Create account";
  $("forgotBtn").classList.toggle("hidden",register);
  $("authNote").textContent=register?"A verification email will be sent after registration.":"";
}
async function loadPublicStats(){
  try{
    const users=await getDocs(collection(db,"users"));
    const jobs=await getDocs(query(collection(db,"jobs"),where("isActive","==",true)));
    let seekers=0,providers=0;
    users.forEach(d=>{if(d.data().role==="seeker")seekers++;if(d.data().role==="provider")providers++;});
    $("homeSeekers").textContent=seekers;
    $("homeJobs").textContent=jobs.size;
    $("homeProviders").textContent=providers;
  }catch(e){ console.error(e); toast("Firebase configuration/setup is required."); }
}

$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    const cred=await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);
    if(!cred.user.emailVerified){ await signOut(auth); return toast("Please verify your email before logging in."); }
    const snap=await getDoc(doc(db,"users",cred.user.uid));
    if(!snap.exists()) return toast("User profile not found.");
    role=snap.data().role; currentUser=cred.user; show("dashboardView"); renderDashboard();
  }catch(e){toast(errorText(e));}
};

$("registerForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("registerEmail").value.trim(), password=$("registerPassword").value;
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,password);
    const u=cred.user;
    const photo=$("profilePhoto").files[0];
    let photoURL="";
    if(photo){const storageRef=ref(storage,`profilePhotos/${u.uid}/${Date.now()}_${photo.name}`);await uploadBytes(storageRef,photo);photoURL=await getDownloadURL(storageRef);}
    const data = role==="seeker"
      ? {uid:u.uid,role:"seeker",name:$("seekerName").value.trim(),phone:$("registerPhone").value.trim(),email,photoURL,createdAt:serverTimestamp()}
      : {uid:u.uid,role:"provider",companyName:$("companyName").value.trim(),personName:$("providerPersonName").value.trim(),phone:$("registerPhone").value.trim(),email,photoURL,createdAt:serverTimestamp()};
    await setDoc(doc(db,"users",u.uid),data);
    await updateProfile(u,{displayName:data.name||data.personName,photoURL});
    await sendEmailVerification(u);
    await signOut(auth);
    toggleAuthMode(false);
    toast("Registered. Check your email and verify your account.");
  }catch(e){toast(errorText(e));}
};

async function forgotPassword(){
  const email=$("loginEmail").value.trim();
  if(!email)return toast("Enter your email first.");
  try{await sendPasswordResetEmail(auth,email);toast("Password reset email sent. Check your inbox.");}
  catch(e){toast(errorText(e));}
}

function renderDashboard(){
  $("topUserName").textContent=currentUser?.displayName||currentUser?.email||"";
  $("jobsNavText").textContent=role==="provider"?"Job Post":"Jobs";
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>switchSection(b.dataset.section));
  switchSection("dashboard");
}
function switchSection(section){
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.section===section));
  document.querySelectorAll(".dash-section").forEach(s=>s.classList.add("hidden"));
  $(`${section}Section`).classList.remove("hidden");
  if(section==="dashboard")renderHomeDashboard();
  if(section==="users")renderUsers();
  if(section==="jobs")renderJobs();
  if(section==="applications")renderApplications();
  if(section==="profile")renderProfile();
}
async function counts(){
  const users=await getDocs(collection(db,"users"));
  const jobs=await getDocs(query(collection(db,"jobs"),where("isActive","==",true)));
  let seekers=0,providers=0; users.forEach(d=>d.data().role==="seeker"?seekers++:providers++);
  return {seekers,providers,jobs:jobs.size};
}
async function renderHomeDashboard(){
  const c=await counts();
  $("dashboardSection").innerHTML=`<h1>Welcome back 👋</h1><p class="empty">${role==="seeker"?"Find your next opportunity.":"Grow your team with the right people."}</p>
  <div class="cards"><div class="metric"><b>${c.seekers}</b><span>Job Seekers</span></div><div class="metric"><b>${c.jobs}</b><span>Job Vacancies</span></div><div class="metric"><b>${c.providers}</b><span>Job Providers / Shops</span></div></div>`;
}
async function renderUsers(){
  const c=await counts();
  $("usersSection").innerHTML=`<h1>Total Users</h1><div class="cards"><div class="metric"><b>${c.seekers}</b><span>Job Seekers</span></div><div class="metric"><b>${c.jobs}</b><span>Job Vacancies</span></div><div class="metric"><b>${c.providers}</b><span>Job Providers</span></div></div>`;
}
function renderJobs(){
  const el=$("jobsSection");
  if(role==="provider"){
    el.innerHTML=`<div class="panel-head"><div><h1>Job Posts</h1><p class="empty">Create and manage your vacancies.</p></div><button class="btn primary" id="newJobBtn">+ Post Job</button></div><div id="jobList" class="job-list"></div>`;
    $("newJobBtn").onclick=()=>openJobModal();
    subscribeJobs(true);
  }else{
    el.innerHTML=`<h1>Available Jobs</h1><p class="empty">Browse active vacancies and apply.</p><div id="jobList" class="job-list"></div>`;
    subscribeJobs(false);
  }
}
function subscribeJobs(own){
  if(unsubscribeJobs)unsubscribeJobs();
  let q=collection(db,"jobs");
  if(own)q=query(q,where("providerId","==",currentUser.uid),where("isActive","==",true),orderBy("createdAt","desc"));
  else q=query(q,where("isActive","==",true),orderBy("createdAt","desc"));
  unsubscribeJobs=onSnapshot(q,snap=>{
    const list=$("jobList"); if(!list)return;
    list.innerHTML=snap.empty?`<div class="empty">No jobs found.</div>`:snap.docs.map(d=>jobCard(d.id,d.data(),own)).join("");
    list.querySelectorAll("[data-apply]").forEach(b=>b.onclick=()=>applyJob(b.dataset.apply));
    list.querySelectorAll("[data-delete-job]").forEach(b=>b.onclick=()=>deleteJob(b.dataset.deleteJob));
    list.querySelectorAll("[data-edit-job]").forEach(b=>b.onclick=()=>openJobModal(b.dataset.editJob));
  },e=>{console.error(e);toast("Could not load jobs.");});
}
function jobCard(id,j,own){
  return `<article class="job-card"><h3>${escapeHtml(j.title)}</h3><div>${escapeHtml(j.department)} · ${escapeHtml(j.jobType)}</div>
  <div class="job-meta"><span class="tag">${escapeHtml(j.experience)}</span><span class="tag">${escapeHtml(j.salary||"Salary not specified")}</span><span class="tag">Deadline: ${escapeHtml(j.deadline)}</span></div>
  <p>${escapeHtml(j.description)}</p><p><b>Requirements:</b> ${escapeHtml(j.requirements)}</p>
  <div class="job-actions">${own?`<button class="btn small" data-edit-job="${id}">Edit</button><button class="btn small danger" data-delete-job="${id}">Delete</button>`:`<button class="btn small primary" data-apply="${id}">Apply</button>`}</div></article>`;
}
async function applyJob(jobId){
  try{
    const q=query(collection(db,"applications"),where("jobId","==",jobId),where("seekerId","==",currentUser.uid));
    if(!(await getDocs(q)).empty)return toast("You already applied for this job.");
    const job=await getDoc(doc(db,"jobs",jobId));
    if(!job.exists())return toast("Job not found.");
    await addDoc(collection(db,"applications"),{jobId,seekerId:currentUser.uid,providerId:job.data().providerId,status:"pending",createdAt:serverTimestamp()});
    toast("Application submitted.");
  }catch(e){toast(errorText(e));}
}
function openJobModal(id=null){
  $("jobModal").classList.remove("hidden");$("editJobId").value=id||"";$("jobModalTitle").textContent=id?"Edit Job":"Post a Job";
  if(!id){$("jobForm").reset();return;}
  getDoc(doc(db,"jobs",id)).then(s=>{const j=s.data();$("jobTitle").value=j.title;$("jobDepartment").value=j.department;$("jobType").value=j.jobType;$("jobExperience").value=j.experience;$("jobSalary").value=j.salary||"";$("jobDescription").value=j.description;$("jobRequirements").value=j.requirements;$("jobDeadline").value=j.deadline;});
}
$("jobForm").onsubmit=async e=>{
  e.preventDefault();
  const data={providerId:currentUser.uid,title:$("jobTitle").value.trim(),department:$("jobDepartment").value.trim(),jobType:$("jobType").value,experience:$("jobExperience").value.trim(),salary:$("jobSalary").value.trim(),description:$("jobDescription").value.trim(),requirements:$("jobRequirements").value.trim(),deadline:$("jobDeadline").value,isActive:true,updatedAt:serverTimestamp()};
  try{
    const id=$("editJobId").value;
    if(id)await updateDoc(doc(db,"jobs",id),data); else await addDoc(collection(db,"jobs"),{...data,createdAt:serverTimestamp()});
    $("jobModal").classList.add("hidden");toast("Job saved.");renderJobs();
  }catch(e){toast(errorText(e));}
};
async function deleteJob(id){
  if(!confirm("Delete this job post?"))return;
  await updateDoc(doc(db,"jobs",id),{isActive:false,updatedAt:serverTimestamp()});toast("Job deleted.");
}
function renderApplications(){
  $("applicationsSection").innerHTML=`<h1>Applications</h1><p class="empty">${role==="provider"?"Review applications and accept or cancel them.":"Track your application status."}</p><div class="panel table-wrap"><table class="data-table"><thead><tr><th>Job</th><th>Applicant/Provider</th><th>Status</th><th>Action</th></tr></thead><tbody id="applicationRows"></tbody></table></div>`;
  if(unsubscribeApplications)unsubscribeApplications();
  const field=role==="provider"?"providerId":"seekerId";
  const q=query(collection(db,"applications"),where(field,"==",currentUser.uid),orderBy("createdAt","desc"));
  unsubscribeApplications=onSnapshot(q,async snap=>{
    const rows=$("applicationRows");if(!rows)return;
    const html=[];
    for(const d of snap.docs){
      const a=d.data(),job=await getDoc(doc(db,"jobs",a.jobId));const j=job.exists()?job.data():{title:"Deleted job"};
      let other="-";
      if(role==="provider"){const u=await getDoc(doc(db,"users",a.seekerId));other=u.exists()?(u.data().name||u.data().email):"-";}
      else{const u=await getDoc(doc(db,"users",a.providerId));other=u.exists()?(u.data().companyName||u.data().personName||u.data().email):"-";}
      html.push(`<tr><td>${escapeHtml(j.title)}</td><td>${escapeHtml(other)}</td><td class="status ${escapeHtml(a.status)}">${escapeHtml(a.status)}</td><td>${role==="provider"?`<button class="btn small" data-accept="${d.id}">Accept</button> <button class="btn small danger" data-cancel="${d.id}">Cancel</button>`:`<button class="btn small danger" data-remove-app="${d.id}">Delete Request</button>`}</td></tr>`);
    }
    rows.innerHTML=html.join("")||`<tr><td colspan="4" class="empty">No applications yet.</td></tr>`;
    rows.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>setApplicationStatus(b.dataset.accept,"accepted"));
    rows.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>setApplicationStatus(b.dataset.cancel,"cancelled"));
    rows.querySelectorAll("[data-remove-app]").forEach(b=>b.onclick=()=>deleteApplication(b.dataset.removeApp));
  });
}
async function setApplicationStatus(id,status){await updateDoc(doc(db,"applications",id),{status,updatedAt:serverTimestamp()});toast(`Application ${status}.`);}
async function deleteApplication(id){if(!confirm("Delete this application request?"))return;await deleteDoc(doc(db,"applications",id));toast("Request deleted.");}
async function renderProfile(){
  const u=await getDoc(doc(db,"users",currentUser.uid));const d=u.data()||{};
  $("profileSection").innerHTML=`<h1>Profile</h1><div class="panel"><div class="profile-head"><img id="profileAvatar" class="avatar" src="${escapeHtml(d.photoURL||"")}" onerror="this.style.display='none'"><div><h2>${escapeHtml(d.name||d.personName||d.companyName||"Profile")}</h2><p>${escapeHtml(d.email||currentUser.email)}</p></div></div>
  <form id="profileForm" class="profile-form"><label>Profile Photo<input id="newProfilePhoto" type="file" accept="image/*"></label>${role==="provider"?`<label>Company / Shop Name<input id="pCompany" value="${escapeHtml(d.companyName||"")}"></label><label>Person Name<input id="pPerson" value="${escapeHtml(d.personName||"")}"></label>`:`<label>Name<input id="pName" value="${escapeHtml(d.name||"")}"></label>`}<label>Phone Number<input id="pPhone" value="${escapeHtml(d.phone||"")}"></label><button class="btn primary">Save Changes</button></form>
  <div class="job-actions"><button id="logoutBtn" class="btn">Logout</button><button id="deleteAccountBtn" class="btn danger">Delete Account</button></div></div>`;
  $("profileForm").onsubmit=saveProfile;$("logoutBtn").onclick=async()=>{await signOut(auth);show("homeView");loadPublicStats();};
  $("deleteAccountBtn").onclick=deleteAccount;
}
async function saveProfile(e){
  e.preventDefault();const data={phone:$("pPhone").value.trim(),updatedAt:serverTimestamp()};
  if(role==="provider"){data.companyName=$("pCompany").value.trim();data.personName=$("pPerson").value.trim();}else data.name=$("pName").value.trim();
  const photo=$("newProfilePhoto").files[0];
  try{
    if(photo){const r=ref(storage,`profilePhotos/${currentUser.uid}/${Date.now()}_${photo.name}`);await uploadBytes(r,photo);data.photoURL=await getDownloadURL(r);}
    await updateDoc(doc(db,"users",currentUser.uid),data);
    await updateProfile(currentUser,{displayName:data.name||data.personName,photoURL:data.photoURL||currentUser.photoURL});
    $("topUserName").textContent=currentUser.displayName||currentUser.email;toast("Profile updated.");renderProfile();
  }catch(e){toast(errorText(e));}
}
async function deleteAccount(){
  const email=prompt("Enter your email address to confirm account deletion:");
  if(!email||email.trim().toLowerCase()!==currentUser.email.toLowerCase())return toast("Email confirmation failed.");
  const password=prompt("Enter your password:");
  if(!password)return;
  try{
    const credential=EmailAuthProvider.credential(currentUser.email,password);
    await reauthenticateWithCredential(currentUser,credential);
    await deleteDoc(doc(db,"users",currentUser.uid));
    const userApps=await getDocs(query(collection(db,"applications"),where(role==="seeker"?"seekerId":"providerId","==",currentUser.uid)));
    for(const d of userApps.docs)await deleteDoc(d.ref);
    if(role==="provider"){const jobs=await getDocs(query(collection(db,"jobs"),where("providerId","==",currentUser.uid)));for(const d of jobs.docs)await deleteDoc(d.ref);}
    await deleteUser(currentUser);show("homeView");loadPublicStats();toast("Account deleted.");
  }catch(e){toast(errorText(e));}
}
function errorText(e){
  const code=e?.code||"";
  const map={"auth/invalid-credential":"Invalid email or password.","auth/email-already-in-use":"Email is already registered.","auth/weak-password":"Password must be at least 6 characters.","auth/invalid-email":"Invalid email address.","auth/user-not-found":"Account not found.","auth/too-many-requests":"Too many attempts. Try again later."};
  return map[code]||e?.message||"Something went wrong.";
}
onAuthStateChanged(auth,async user=>{
  if(!user){currentUser=null;return;}
  if(user.emailVerified){
    currentUser=user;
    const s=await getDoc(doc(db,"users",user.uid));
    if(s.exists()){role=s.data().role;show("dashboardView");renderDashboard();}
  }
});
