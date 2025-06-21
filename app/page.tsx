"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts"
import {
  Search,
  Download,
  Star,
  User,
  Film,
  Filter,
  Github,
  Sparkles,
  Play,
  Eye,
  Heart,
  Loader2,
  AlertCircle,
  Database,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Type definitions for the CSV data structure
interface MovieRecommendation {
  user_id: string
  recommended_movie_id: string
  recommended_movie_title: string
  genre: string
  reason: string
  predicted_rating?: number
  year?: number
}

interface UserProfile {
  totalMoviesWatched: number
  averageRating: number
  topGenres: string[]
  location?: string
  age?: number
  joinDate?: string
}

const genreColors: Record<string, string> = {
  "Sci-Fi": "#8b5cf6",
  Action: "#ef4444",
  Romance: "#ec4899",
  Comedy: "#f59e0b",
  Drama: "#06b6d4",
  Thriller: "#64748b",
  Horror: "#dc2626",
  Adventure: "#059669",
  Animation: "#7c3aed",
  Documentary: "#0891b2",
  Fantasy: "#c026d3",
  Mystery: "#4338ca",
  Crime: "#dc2626",
  Family: "#10b981",
  Musical: "#f59e0b",
  Western: "#92400e",
  War: "#374151",
  Biography: "#6b7280",
  History: "#78716c",
  Sport: "#16a34a",
}

// CSV parsing utility function
const parseCSV = (csvText: string): MovieRecommendation[] => {
  const lines = csvText.trim().split("\n")
  if (lines.length === 0) return []

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
      const row: any = {}

      headers.forEach((header, index) => {
        const value = values[index] || ""

        // Map CSV headers to our interface (flexible header matching)
        switch (header.toLowerCase()) {
          case "user_id":
          case "userid":
          case "user":
            row.user_id = value
            break
          case "recommended_movie_id":
          case "movie_id":
          case "movieid":
          case "id":
            row.recommended_movie_id = value
            break
          case "recommended_movie_title":
          case "movie_title":
          case "title":
          case "movie":
            row.recommended_movie_title = value
            break
          case "genre":
          case "genres":
          case "category":
            row.genre = value
            break
          case "reason":
          case "recommendation_reason":
          case "explanation":
            row.reason = value
            break
          case "predicted_rating":
          case "rating":
          case "score":
          case "prediction":
            row.predicted_rating = Number.parseFloat(value) || undefined
            break
          case "year":
          case "release_year":
          case "movie_year":
            row.year = Number.parseInt(value) || undefined
            break
          default:
            // Handle any additional columns
            row[header] = value
        }
      })

      return row as MovieRecommendation
    })
    .filter((row) => row.user_id && row.recommended_movie_title) // Filter out invalid rows
}

// Generate user profiles from recommendation data
const generateUserProfiles = (recommendations: MovieRecommendation[]): Record<string, UserProfile> => {
  const profiles: Record<string, UserProfile> = {}

  const userGroups = recommendations.reduce(
    (acc, rec) => {
      if (!acc[rec.user_id]) acc[rec.user_id] = []
      acc[rec.user_id].push(rec)
      return acc
    },
    {} as Record<string, MovieRecommendation[]>,
  )

  Object.entries(userGroups).forEach(([userId, userRecs]) => {
    const genres = userRecs.map((r) => r.genre).filter(Boolean)
    const ratings = userRecs.map((r) => r.predicted_rating).filter(Boolean) as number[]

    const genreCount = genres.reduce(
      (acc, genre) => {
        acc[genre] = (acc[genre] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const topGenres = Object.entries(genreCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genre]) => genre)

    profiles[userId] = {
      totalMoviesWatched: userRecs.length,
      averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      topGenres,
      location: `Location ${userId.slice(-3)}`, // Placeholder
      age: Math.floor(Math.random() * 30) + 20, // Placeholder
      joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split("T")[0], // Placeholder
    }
  })

  return profiles
}

export default function MovieDashboard() {
  // State for data management
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([])
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string>("")
  const [dataStats, setDataStats] = useState<{
    totalRecommendations: number
    totalUsers: number
    totalGenres: number
    avgRating: number
  } | null>(null)

  // Filter states
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [selectedGenre, setSelectedGenre] = useState<string>("all")
  const [topN, setTopN] = useState<string>("10")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Load CSV data on component mount
  useEffect(() => {
    const loadCSVData = async () => {
      try {
        setIsLoading(true)
        setDataError("")

        // Try to fetch the CSV file from the public directory
        const response = await fetch("/data/final_model_output.csv")

        if (!response.ok) {
          throw new Error(`Failed to load CSV file: ${response.status} ${response.statusText}`)
        }

        const csvText = await response.text()
        const parsedData = parseCSV(csvText)

        if (parsedData.length === 0) {
          throw new Error("No valid data found in CSV file")
        }

        setRecommendations(parsedData)
        const profiles = generateUserProfiles(parsedData)
        setUserProfiles(profiles)

        // Calculate data statistics
        const ratings = parsedData.map((r) => r.predicted_rating).filter(Boolean) as number[]
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

        setDataStats({
          totalRecommendations: parsedData.length,
          totalUsers: Object.keys(profiles).length,
          totalGenres: [...new Set(parsedData.map((r) => r.genre).filter(Boolean))].length,
          avgRating,
        })
      } catch (error) {
        console.error("Error loading CSV data:", error)
        setDataError(error instanceof Error ? error.message : "Failed to load recommendation data")
      } finally {
        setIsLoading(false)
      }
    }

    loadCSVData()
  }, [])

  const uniqueUsers = [...new Set(recommendations.map((r) => r.user_id))].sort()
  const uniqueGenres = [...new Set(recommendations.map((r) => r.genre))].filter(Boolean).sort()

  const filteredRecommendations = useMemo(() => {
    let filtered = recommendations

    if (selectedUser) {
      filtered = filtered.filter((r) => r.user_id === selectedUser)
    }

    if (selectedGenre !== "all") {
      filtered = filtered.filter((r) => r.genre === selectedGenre)
    }

    if (searchQuery) {
      filtered = filtered.filter((r) => r.recommended_movie_title.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    return filtered.slice(0, Number.parseInt(topN))
  }, [recommendations, selectedUser, selectedGenre, searchQuery, topN])

  const genreDistribution = useMemo(() => {
    const distribution = filteredRecommendations.reduce(
      (acc, rec) => {
        if (rec.genre) {
          acc[rec.genre] = (acc[rec.genre] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(distribution).map(([genre, count]) => ({
      genre,
      count,
      fill: genreColors[genre] || "#64748b",
    }))
  }, [filteredRecommendations])

  const ratingDistribution = useMemo(() => {
    const ranges = [
      { range: "4.5-5.0", min: 4.5, max: 5.0 },
      { range: "4.0-4.4", min: 4.0, max: 4.4 },
      { range: "3.5-3.9", min: 3.5, max: 3.9 },
      { range: "3.0-3.4", min: 3.0, max: 3.4 },
      { range: "Below 3.0", min: 0, max: 2.9 },
    ]

    return ranges
      .map(({ range, min, max }) => ({
        range,
        count: filteredRecommendations.filter(
          (r) => r.predicted_rating && r.predicted_rating >= min && r.predicted_rating <= max,
        ).length,
      }))
      .filter((item) => item.count > 0)
  }, [filteredRecommendations])

  const currentUserProfile = selectedUser ? userProfiles[selectedUser] : null

  const exportRecommendations = () => {
    const csvContent = [
      ["User ID", "Movie ID", "Movie Title", "Genre", "Reason", "Predicted Rating", "Year"],
      ...filteredRecommendations.map((r) => [
        r.user_id,
        r.recommended_movie_id,
        r.recommended_movie_title,
        r.genre || "",
        r.reason || "",
        r.predicted_rating?.toString() || "",
        r.year?.toString() || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `movie_recommendations_filtered_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSelectedUser("")
    setSelectedGenre("all")
    setTopN("10")
    setSearchQuery("")
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm p-8">
          <CardContent className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <p className="text-white text-lg">Loading recommendation data...</p>
            <p className="text-slate-400 text-sm">Please wait while we process your CSV file</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (dataError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm p-8 max-w-md">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <h2 className="text-white text-xl font-semibold">Data Loading Error</h2>
            <p className="text-slate-400">{dataError}</p>
            <div className="text-sm text-slate-500 mt-4">
              <p>
                Expected file location: <code>/public/data/final_model_output.csv</code>
              </p>
              <p className="mt-2">Make sure your CSV file is placed in the correct directory.</p>
            </div>
            <Button onClick={() => window.location.reload()} className="bg-purple-600 hover:bg-purple-700 mt-4">
              Retry Loading
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-sm">
          <div className="absolute inset-0 bg-[url('/placeholder.svg?height=600&width=1200')] bg-cover bg-center opacity-10" />
          <div className="relative container mx-auto px-4 py-20 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Sparkles className="h-8 w-8 text-purple-400" />
              <h1 className="text-5xl font-bold text-white">AI-Powered Movie Recommendation System</h1>
              <Sparkles className="h-8 w-8 text-purple-400" />
            </div>
            <p className="text-xl text-purple-200 mb-8 max-w-2xl mx-auto">
              Discover smart, personalized movie picks with Spark-powered intelligence. Experience the future of
              entertainment curation.
            </p>
            <Button
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => document.getElementById("filters")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Play className="mr-2 h-5 w-5" />
              Explore Recommendations
            </Button>

            {/* Data Statistics */}
            {dataStats && (
              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{dataStats.totalRecommendations.toLocaleString()}</div>
                  <div className="text-purple-300 text-sm">Recommendations</div>
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{dataStats.totalUsers}</div>
                  <div className="text-purple-300 text-sm">Users</div>
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{dataStats.totalGenres}</div>
                  <div className="text-purple-300 text-sm">Genres</div>
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{dataStats.avgRating.toFixed(1)}</div>
                  <div className="text-purple-300 text-sm">Avg Rating</div>
                </div>
              </div>
            )}

            {/* Data Source Indicator */}
            <Alert className="max-w-md mx-auto mt-6 bg-green-900/20 border-green-600">
              <Database className="h-4 w-4" />
              <AlertDescription className="text-green-200">
                Data loaded from final_model_output.csv ({recommendations.length} records)
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* User Filter Panel */}
            <div className="lg:col-span-1">
              <Card id="filters" className="bg-slate-800/50 border-slate-700 backdrop-blur-sm sticky top-4">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {recommendations.length} total recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="user-select" className="text-slate-300">
                      Select User ({uniqueUsers.length} users)
                    </Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Choose a user..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                        {uniqueUsers.map((user) => (
                          <SelectItem key={user} value={user} className="text-white hover:bg-slate-700">
                            {user}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="genre-select" className="text-slate-300">
                      Genre Filter ({uniqueGenres.length} genres)
                    </Label>
                    <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                        <SelectItem value="all" className="text-white hover:bg-slate-700">
                          All Genres
                        </SelectItem>
                        {uniqueGenres.map((genre) => (
                          <SelectItem key={genre} value={genre} className="text-white hover:bg-slate-700">
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="top-n" className="text-slate-300">
                      Top N Movies
                    </Label>
                    <Select value={topN} onValueChange={setTopN}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="5" className="text-white hover:bg-slate-700">
                          Top 5
                        </SelectItem>
                        <SelectItem value="10" className="text-white hover:bg-slate-700">
                          Top 10
                        </SelectItem>
                        <SelectItem value="20" className="text-white hover:bg-slate-700">
                          Top 20
                        </SelectItem>
                        <SelectItem value="50" className="text-white hover:bg-slate-700">
                          Top 50
                        </SelectItem>
                        <SelectItem value="100" className="text-white hover:bg-slate-700">
                          Top 100
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="search" className="text-slate-300">
                      Search Movies
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="search"
                        placeholder="Search movie titles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={exportRecommendations}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={filteredRecommendations.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Filtered Data
                  </Button>

                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>

              {/* User Profile Panel */}
              {currentUserProfile && (
                <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm mt-6">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-300">User ID:</span>
                      <span className="text-white font-mono">{selectedUser}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Recommendations:</span>
                      <span className="text-white">{currentUserProfile.totalMoviesWatched}</span>
                    </div>
                    {currentUserProfile.averageRating > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-300">Avg Rating:</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-white">{currentUserProfile.averageRating.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-300">Top Genres:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentUserProfile.topGenres.map((genre) => (
                          <Badge
                            key={genre}
                            variant="secondary"
                            style={{ backgroundColor: (genreColors[genre] || "#64748b") + "20" }}
                            className="text-xs"
                          >
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {currentUserProfile.location && (
                      <div className="flex justify-between">
                        <span className="text-slate-300">Location:</span>
                        <span className="text-white text-sm">{currentUserProfile.location}</span>
                      </div>
                    )}
                    {currentUserProfile.joinDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-300">Member Since:</span>
                        <span className="text-white text-sm">{currentUserProfile.joinDate}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Data Insights Panel */}
              {filteredRecommendations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Genre Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          count: {
                            label: "Movies",
                            color: "hsl(var(--chart-1))",
                          },
                        }}
                        className="h-[200px]"
                      >
                        <PieChart>
                          <Pie
                            data={genreDistribution}
                            dataKey="count"
                            nameKey="genre"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                          >
                            {genreDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Rating Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          count: {
                            label: "Movies",
                            color: "hsl(var(--chart-2))",
                          },
                        }}
                        className="h-[200px]"
                      >
                        <BarChart data={ratingDistribution}>
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Bar dataKey="count" fill="#8b5cf6" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Recommendations Grid */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Film className="h-6 w-6" />
                    {selectedUser ? `Recommendations for ${selectedUser}` : "Movie Recommendations"}
                  </h2>
                  <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                    {filteredRecommendations.length} movies
                  </Badge>
                </div>

                {filteredRecommendations.length === 0 ? (
                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                      <Film className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400 text-lg">
                        {selectedUser
                          ? "No recommendations found for the selected filters."
                          : "Please select a user to view recommendations."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredRecommendations.map((rec, index) => (
                      <Card
                        key={`${rec.user_id}-${rec.recommended_movie_id}-${index}`}
                        className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-white text-lg leading-tight">
                                {rec.recommended_movie_title}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {rec.genre && (
                                  <Badge
                                    style={{ backgroundColor: genreColors[rec.genre] || "#64748b" }}
                                    className="text-white"
                                  >
                                    {rec.genre}
                                  </Badge>
                                )}
                                {rec.year && (
                                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                                    {rec.year}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {rec.predicted_rating && (
                              <div className="text-right">
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="flex items-center gap-1">
                                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                      <span className="text-white font-semibold">
                                        {rec.predicted_rating.toFixed(1)}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Predicted Rating</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="aspect-video bg-slate-700 rounded-lg mb-4 flex items-center justify-center">
                            <Film className="h-12 w-12 text-slate-500" />
                          </div>
                          {rec.reason && (
                            <CardDescription className="text-slate-300 text-sm leading-relaxed">
                              <span className="font-medium text-purple-300">Why recommended:</span>
                              <br />
                              {rec.reason}
                            </CardDescription>
                          )}
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400">
                              <Heart className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-slate-900/80 backdrop-blur-sm border-t border-slate-700 mt-12">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Movie Recommendation System
                </h3>
                <p className="text-slate-400 text-sm">
                  Powered by Apache Spark and PySpark, delivering intelligent movie recommendations through advanced
                  machine learning algorithms.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Technology Stack</h4>
                <ul className="text-slate-400 text-sm space-y-2">
                  <li>• Apache Spark & PySpark</li>
                  <li>• Machine Learning Pipeline</li>
                  <li>• Collaborative Filtering</li>
                  <li>• Google Colab Development</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Resources</h4>
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-0 h-auto">
                    <Github className="h-4 w-4 mr-2" />
                    View on GitHub
                  </Button>
                  <p className="text-slate-400 text-xs">Developed using PySpark on Google Colab</p>
                </div>
              </div>
            </div>
            <Separator className="my-6 bg-slate-700" />
            <div className="text-center text-slate-400 text-sm">
              <p>© 2024 Movie Recommendation System. Built with Next.js and shadcn/ui.</p>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}
