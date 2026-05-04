export const adminWebHtml = (storeName = 'Green & Grains') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${storeName} Admin</title>
  <style>
    body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f4f5f7;color:#1c2430}
    .shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
    .sidebar{background:#1d2734;color:#fff;padding:20px}
    .sidebar h2{margin:0 0 18px;font-size:18px}
    .nav a{display:block;color:#d9dee5;text-decoration:none;padding:10px 8px;border-radius:8px}
    .nav a:hover{background:#2b3a4d}
    .content{padding:24px}
    .card{background:#fff;border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(20,20,20,.06);margin-bottom:16px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:12px}
    .metric{background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 10px rgba(20,20,20,.06)}
    .metric h3{margin:0 0 8px;font-size:13px;color:#5b6472}
    .metric p{margin:0;font-size:24px;font-weight:700}
    .login{max-width:420px;margin:48px auto;background:#fff;padding:20px;border-radius:14px;box-shadow:0 2px 10px rgba(20,20,20,.08)}
    input,button{width:100%;padding:12px;border-radius:10px;border:1px solid #dce1e7;margin-top:10px;box-sizing:border-box}
    button{background:#89c54c;border:none;color:#fff;font-weight:600;cursor:pointer}
    @media (max-width: 900px){.shell{grid-template-columns:1fr}.sidebar{display:none}.grid{grid-template-columns:repeat(2,minmax(100px,1fr))}}
  </style>
</head>
<body>
<div id="app"></div>
<script>
const app = document.getElementById('app');
const token = localStorage.getItem('admin_access_token');

function renderLogin(){
  app.innerHTML = "<div class='login'><h2>Admin Login</h2><input id='email' placeholder='Email'><input id='password' type='password' placeholder='Password'><button onclick='login()'>Login</button><p id='err' style='color:#d22'></p></div>";
}

async function login(){
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data = await res.json();
  if(!res.ok){document.getElementById('err').innerText = data.detail || 'Login failed';return;}
  localStorage.setItem('admin_access_token', data.access_token);
  loadDashboard();
}

async function loadDashboard(){
  const tk = localStorage.getItem('admin_access_token');
  if(!tk){renderLogin();return;}
  const res = await fetch('/api/v1/admin/dashboard/summary',{headers:{Authorization:'Bearer ' + tk}});
  if(res.status===401||res.status===403){localStorage.removeItem('admin_access_token');renderLogin();return;}
  const payload = await res.json();
  const d = payload.data || {};
  app.innerHTML = "<div class='shell'><aside class='sidebar'><h2>${storeName} Admin</h2><nav class='nav'><a href='#'>Dashboard</a><a href='#'>Products</a><a href='#'>Orders</a><a href='#'>Banners</a><a href='#'>Inventory</a><a href='#' onclick='logout()'>Logout</a></nav></aside><main class='content'><div class='grid'><div class='metric'><h3>Total Orders</h3><p>" + (d.total_orders || 0) + "</p></div><div class='metric'><h3>Pending Orders</h3><p>" + (d.pending_orders || 0) + "</p></div><div class='metric'><h3>Revenue</h3><p>Rs." + Number(d.total_revenue || 0).toFixed(2) + "</p></div><div class='metric'><h3>Low Stock Alerts</h3><p>" + (d.low_stock_alerts || 0) + "</p></div></div><div class='card'><h3>Active Banners: " + (d.active_banners || 0) + "</h3><p>Use admin APIs to manage full modules.</p></div><div class='card'><h3>Top Products</h3><pre>" + JSON.stringify(d.top_selling_products || [], null, 2) + "</pre></div></main></div>";
}

function logout(){
  localStorage.removeItem('admin_access_token');
  renderLogin();
}

if(token){loadDashboard();}else{renderLogin();}
</script>
</body>
</html>`;
