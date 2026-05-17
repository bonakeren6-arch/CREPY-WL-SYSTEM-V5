const productNameInput = document.getElementById('productName');
const addProductBtn = document.getElementById('addProductBtn');
const productListEl = document.getElementById('productList');
const generatedScriptEl = document.getElementById('generatedScript');
const copyScriptBtn = document.getElementById('copyScriptBtn');
const obfuscateBtn = document.getElementById('obfuscateBtn');
const whitelistLinkInput = document.getElementById('whitelistLink');
const addWhitelistBtn = document.getElementById('addWhitelistBtn');
const whitelistListEl = document.getElementById('whitelistList');
const logOutputEl = document.getElementById('logOutput');
const allowHttpRequestsEl = document.getElementById('allowHttpRequests');

let products = [];
let whitelist = [];
let lastGeneratedScript = '';
let lastGeneratedProduct = '';

function formatLinkType(link) {
  if (/group\.roblox\.com/i.test(link) || /groups\/\d+/i.test(link)) {
    return 'Group';
  }
  if (/users?\/\d+|roblox\.com\/users?\//i.test(link) || /^\d+$/.test(link)) {
    return 'Profile';
  }
  return 'Unknown';
}

function parseWhitelistEntry(link) {
  const normalized = link.trim();
  const profileIdMatch = normalized.match(/(?:users?\/|users?\.aspx\?id=|=)(\d+)/i) || normalized.match(/^(\d+)$/);
  const groupIdMatch = normalized.match(/(?:groups?\/)(\d+)/i);

  if (profileIdMatch) {
    return {
      type: 'Profile',
      key: Number(profileIdMatch[1]),
      display: `Profile ${profileIdMatch[1]}`,
      raw: normalized,
    };
  }

  if (groupIdMatch) {
    return {
      type: 'Group',
      key: Number(groupIdMatch[1]),
      display: `Group ${groupIdMatch[1]}`,
      raw: normalized,
    };
  }

  return {
    type: 'Unknown',
    key: normalized,
    display: normalized,
    raw: normalized,
  };
}

function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  logOutputEl.textContent += `[${timestamp}] ${message}\n`;
  logOutputEl.parentElement.scrollTop = logOutputEl.parentElement.scrollHeight;
}

function saveState() {
  localStorage.setItem('rbxWhitelist_products', JSON.stringify(products));
  localStorage.setItem('rbxWhitelist_whitelist', JSON.stringify(whitelist));
  localStorage.setItem('rbxWhitelist_allowHttp', allowHttpRequestsEl.checked.toString());
}

function loadState() {
  const productsData = localStorage.getItem('rbxWhitelist_products');
  const whitelistData = localStorage.getItem('rbxWhitelist_whitelist');
  const httpState = localStorage.getItem('rbxWhitelist_allowHttp');
  if (productsData) products = JSON.parse(productsData);
  if (whitelistData) whitelist = JSON.parse(whitelistData);
  allowHttpRequestsEl.checked = httpState === 'true';
}

function renderProducts() {
  productListEl.innerHTML = '';
  products.forEach((product, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${product.name}</td>
      <td><button class="small" data-index="${index}">Generate Script</button></td>
    `;
    productListEl.appendChild(tr);
  });
}

function renderWhitelist() {
  whitelistListEl.innerHTML = '';
  whitelist.forEach((entry) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${entry.display}</td>
      <td>${entry.type}</td>
      <td>${entry.status}</td>
    `;
    whitelistListEl.appendChild(tr);
  });
}

function createScriptForProduct(productName) {
  const profileIds = whitelist
    .filter((entry) => entry.type === 'Profile' && Number.isFinite(entry.key))
    .map((entry) => entry.key);
  const groupIds = whitelist
    .filter((entry) => entry.type === 'Group' && Number.isFinite(entry.key))
    .map((entry) => entry.key);

  const profileTable = profileIds.length
    ? profileIds.map((id) => `  [${id}] = true`).join(',\n')
    : '';
  const groupTable = groupIds.length
    ? groupIds.map((id) => `  [${id}] = true`).join(',\n')
    : '';

  const profileSection = profileTable
    ? `local whitelistedUserIds = {\n${profileTable}\n}`
    : 'local whitelistedUserIds = {}';
  const groupSection = groupTable
    ? `local whitelistedGroupIds = {\n${groupTable}\n}`
    : 'local whitelistedGroupIds = {}';

  return `-- Roblox ServerScriptService script for product: ${productName}\nlocal Players = game:GetService('Players')\n\n${profileSection}\n${groupSection}\n\nlocal function isWhitelisted(player)\n  if whitelistedUserIds[player.UserId] then\n    return true\n  end\n  for groupId, _ in pairs(whitelistedGroupIds) do\n    if player:IsInGroup(groupId) then\n      return true\n    end\n  end\n  return false\nend\n\nPlayers.PlayerAdded:Connect(function(player)\n  player.CharacterAdded:Connect(function(character)\n    local humanoid = character:WaitForChild('Humanoid')\n    if not isWhitelisted(player) then\n      humanoid.WalkSpeed = 0\n      humanoid.JumpPower = 0\n      warn(player.Name .. ' tidak di-whitelist, movement di-disable')\n    else\n      humanoid.WalkSpeed = 16\n      humanoid.JumpPower = 50\n      print(player.Name .. ' sudah whitelist, movement diijinkan')\n    end\n  end)\nend)`;
}

function obfuscateLua(code) {
  const encoded = btoa(code);
  return `local decode = function(data)\n  local source = game:GetService('HttpService'):Base64Decode(data)\n  return source\nend\nlocal scriptSource = decode('${encoded}')\nloadstring(scriptSource)()`;
}

function updateUI() {
  renderProducts();
  renderWhitelist();
  saveState();
}

addProductBtn.addEventListener('click', () => {
  const name = productNameInput.value.trim();
  if (!name) {
    alert('Isi nama product dulu.');
    return;
  }
  products.push({ name });
  productNameInput.value = '';
  lastGeneratedProduct = name;
  lastGeneratedScript = createScriptForProduct(name);
  generatedScriptEl.value = lastGeneratedScript;
  addLog(`Product ditambahkan: ${name}. Script otomatis dibuat untuk product ini.`);
  updateUI();
});

productListEl.addEventListener('click', (event) => {
  if (!event.target.matches('button')) return;
  const index = Number(event.target.dataset.index);
  const product = products[index];
  if (!product) return;
  lastGeneratedProduct = product.name;
  lastGeneratedScript = createScriptForProduct(product.name);
  generatedScriptEl.value = lastGeneratedScript;
  addLog(`Script di-generate untuk product: ${product.name}. Paste script ini ke ServerScriptService.`);
});

addWhitelistBtn.addEventListener('click', () => {
  const link = whitelistLinkInput.value.trim();
  if (!link) {
    alert('Masukkan link profil atau grup Roblox.');
    return;
  }
  const entry = parseWhitelistEntry(link);
  const status = allowHttpRequestsEl.checked ? 'Whitelist' : 'Belum HTTP Request';
  whitelist.push({ ...entry, status });
  whitelistLinkInput.value = '';
  addLog(`Whitelist ditambahkan: ${entry.display} (${entry.type}) - status: ${status}`);
  updateUI();
});

copyScriptBtn.addEventListener('click', () => {
  if (!generatedScriptEl.value) {
    alert('Tidak ada script untuk disalin. Generate terlebih dahulu.');
    return;
  }
  navigator.clipboard.writeText(generatedScriptEl.value).then(() => {
    addLog('Script berhasil disalin ke clipboard.');
  });
});

obfuscateBtn.addEventListener('click', () => {
  if (!generatedScriptEl.value) {
    alert('Generate script dulu sebelum obfuscate.');
    return;
  }
  const obfuscated = obfuscateLua(generatedScriptEl.value);
  generatedScriptEl.value = obfuscated;
  addLog(`Script untuk product: ${lastGeneratedProduct || 'unknown'} di-obfuscate. Paste ke ServerScriptService setelah di-copy.`);
});

allowHttpRequestsEl.addEventListener('change', () => {
  whitelist = whitelist.map((entry) => ({
    ...entry,
    status: allowHttpRequestsEl.checked ? 'Whitelist' : 'Belum HTTP Request',
  }));
  addLog(`Allow HTTP Requests ${allowHttpRequestsEl.checked ? 'aktif' : 'nonaktif'}`);
  updateUI();
});

loadState();
updateUI();
addLog('Aplikasi whitelist siap digunakan.');
