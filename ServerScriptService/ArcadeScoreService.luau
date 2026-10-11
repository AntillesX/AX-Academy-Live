--!strict
-- Server ModuleScript: accepts only server-validated arcade results and records them in Supabase.
-- Games must call RegisterScoreValidator with their trusted simulation validator before any
-- client result can earn XP. Without one, submissions are rejected by design.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local SupabaseClient = require(ServerScriptService:WaitForChild("SupabaseClient"))
local supabase = SupabaseClient.fromServerStorage()

export type ScoreValidator = (player: Player, score: number) -> (boolean, number?)

local validators: {[string]: ScoreValidator} = {}
local submissionTimes: {[Player]: number} = {}
local SUBMISSION_COOLDOWN_SECONDS = 2

local remotes = ReplicatedStorage:FindFirstChild("AntillesXRemotes")
if not remotes then
	remotes = Instance.new("Folder")
	remotes.Name = "AntillesXRemotes"
	remotes.Parent = ReplicatedStorage
end

local submitRemote = remotes:FindFirstChild("SubmitArcadeScore")
if not submitRemote then
	submitRemote = Instance.new("RemoteEvent")
	submitRemote.Name = "SubmitArcadeScore"
	submitRemote.Parent = remotes
end
assert(submitRemote:IsA("RemoteEvent"), "AntillesXRemotes.SubmitArcadeScore must be a RemoteEvent")

local function isUuid(value: any): boolean
	if type(value) ~= "string" then
		return false
	end
	local compact, hyphenCount = string.gsub(value, "-", "")
	return #compact == 32 and hyphenCount == 4 and string.match(compact, "^[0-9a-fA-F]+$") ~= nil
end

local function isValidGameName(value: any): boolean
	return type(value) == "string" and string.match(value, "^[%w _%-]+$") ~= nil and #value <= 80
end

local function RegisterScoreValidator(gameName: string, validator: ScoreValidator)
	assert(isValidGameName(gameName), "gameName must be 1-80 safe characters")
	assert(type(validator) == "function", "validator must be a function")
	validators[gameName] = validator
end

(submitRemote :: RemoteEvent).OnServerEvent:Connect(function(player, payload)
	if type(payload) ~= "table" or not isValidGameName(payload.gameName) then
		return
	end
	if type(payload.score) ~= "number" or payload.score ~= payload.score or payload.score < 0 or payload.score % 1 ~= 0 then
		return
	end

	local now = os.clock()
	if now - (submissionTimes[player] or 0) < SUBMISSION_COOLDOWN_SECONDS then
		return
	end
	submissionTimes[player] = now

	local userId = player:GetAttribute("SupabaseUserId")
	if not isUuid(userId) then
		warn(string.format("Rejected arcade score from unverified player %d", player.UserId))
		return
	end

	local validator = validators[payload.gameName]
	if not validator then
		warn(string.format("Rejected arcade score for %s because no server validator is registered", payload.gameName))
		return
	end

	local valid, xpEarned = validator(player, payload.score)
	if not valid then
		warn(string.format("Rejected invalid arcade score for %s from player %d", payload.gameName, player.UserId))
		return
	end

	local safeXp = math.max(0, math.floor(tonumber(xpEarned) or 0))
	local result = supabase:rpc("record_arcade_score", {
		p_user_id = userId,
		p_game_name = payload.gameName,
		p_score = math.floor(payload.score),
		p_xp_earned = safeXp,
	})
	if not result.ok then
		warn(string.format("Unable to record arcade score: %s", result.error or "unknown Supabase error"))
		return
	end

	if type(result.data) == "table" and result.data[1] then
		player:SetAttribute("XPBalance", tonumber(result.data[1].xp_balance) or 0)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	submissionTimes[player] = nil
end)

return {
	RegisterScoreValidator = RegisterScoreValidator,
}
