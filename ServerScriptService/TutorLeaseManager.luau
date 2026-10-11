--!strict
-- Server Script: securely leases spatial tutor rooms through the lease_tutor_room Supabase RPC.
-- Before enabling, configure ServerStorage.SupabaseConfig with the service-role key and set the
-- SupabaseUserId Player attribute only from a verified server-side identity bridge.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local SupabaseClient = require(ServerScriptService:WaitForChild("SupabaseClient"))
-- ArcadeScoreService is a server ModuleScript; requiring it installs its guarded RemoteEvent receiver.
require(ServerScriptService:WaitForChild("ArcadeScoreService"))
local supabase = SupabaseClient.fromServerStorage()

local ROOM_LEASE_COST_ANTX = 100
local LEASE_DURATION_SECONDS = 60 * 60
local REQUEST_COOLDOWN_SECONDS = 3

local requestTimes: {[Player]: number} = {}

local remotes = ReplicatedStorage:FindFirstChild("AntillesXRemotes")
if not remotes then
	remotes = Instance.new("Folder")
	remotes.Name = "AntillesXRemotes"
	remotes.Parent = ReplicatedStorage
end

local leaseRemote = remotes:FindFirstChild("LeaseTutorRoom")
if not leaseRemote then
	leaseRemote = Instance.new("RemoteFunction")
	leaseRemote.Name = "LeaseTutorRoom"
	leaseRemote.Parent = remotes
end
assert(leaseRemote:IsA("RemoteFunction"), "AntillesXRemotes.LeaseTutorRoom must be a RemoteFunction")

local leaseState = remotes:FindFirstChild("TutorLeaseState")
if not leaseState then
	leaseState = Instance.new("RemoteEvent")
	leaseState.Name = "TutorLeaseState"
	leaseState.Parent = remotes
end
assert(leaseState:IsA("RemoteEvent"), "AntillesXRemotes.TutorLeaseState must be a RemoteEvent")

local function isUuid(value: any): boolean
	if type(value) ~= "string" then
		return false
	end
	local compact, hyphenCount = string.gsub(value, "-", "")
	return #compact == 32 and hyphenCount == 4 and string.match(compact, "^[0-9a-fA-F]+$") ~= nil
end

local function sendWalletSnapshot(player: Player, userId: string)
	local response = supabase:select("user_wallets", {
		select = "xp_balance,antx_balance",
		user_id = "eq." .. userId,
	})
	if response.ok and type(response.data) == "table" and response.data[1] then
		local wallet = response.data[1]
		player:SetAttribute("XPBalance", tonumber(wallet.xp_balance) or 0)
		player:SetAttribute("AntXBalance", tonumber(wallet.antx_balance) or 0)
	end
end

local function leaseTutorRoom(player: Player, request: any)
	if type(request) ~= "table" then
		return { ok = false, error = "Invalid lease request." }
	end

	local currentTime = os.clock()
	if currentTime - (requestTimes[player] or 0) < REQUEST_COOLDOWN_SECONDS then
		return { ok = false, error = "Please wait before trying another lease." }
	end
	requestTimes[player] = currentTime

	local userId = player:GetAttribute("SupabaseUserId")
	if not isUuid(userId) then
		return { ok = false, error = "Your AntillesX identity has not been verified." }
	end

	local islandName = request.islandName
	local roomNumber = request.roomNumber
	if type(islandName) ~= "string" or #islandName < 1 or #islandName > 80 then
		return { ok = false, error = "Invalid island name." }
	end
	if type(roomNumber) ~= "number" or roomNumber % 1 ~= 0 or roomNumber < 1 or roomNumber > 10000 then
		return { ok = false, error = "Invalid room number." }
	end

	local expiresAt = DateTime.fromUnixTimestamp(os.time() + LEASE_DURATION_SECONDS):ToIsoDate()
	local response = supabase:rpc("lease_tutor_room", {
		p_user_id = userId,
		p_tutor_id = userId,
		p_island_name = islandName,
		p_room_number = roomNumber,
		p_expires_at = expiresAt,
		p_antx_cost = ROOM_LEASE_COST_ANTX,
	})

	if not response.ok then
		warn(string.format("Tutor lease failed for %d: %s", player.UserId, response.error or "unknown Supabase error"))
		return { ok = false, error = "Unable to lease this room. It may be occupied or your AntX balance may be too low." }
	end

	sendWalletSnapshot(player, userId)
	local lease = response.data
	if type(lease) == "table" and lease[1] then
		lease = lease[1]
	end
	leaseState:FireClient(player, lease)
	return { ok = true, lease = lease, antxCost = ROOM_LEASE_COST_ANTX }
end

(leaseRemote :: RemoteFunction).OnServerInvoke = leaseTutorRoom

Players.PlayerRemoving:Connect(function(player)
	requestTimes[player] = nil
end)

Players.PlayerAdded:Connect(function(player)
	player:GetAttributeChangedSignal("SupabaseUserId"):Connect(function()
		local userId = player:GetAttribute("SupabaseUserId")
		if isUuid(userId) then
			sendWalletSnapshot(player, userId)
		end
	end)

	local userId = player:GetAttribute("SupabaseUserId")
	if isUuid(userId) then
		sendWalletSnapshot(player, userId)
	end
end)
