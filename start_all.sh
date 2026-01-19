#!/bin/bash
# ============================================================================
# INSTANT HARMONIES - Combined Startup Script
# ============================================================================
# Starts both backend (Flask) and frontend (HTTP) servers
# Press Ctrl+C once to stop both servers cleanly
# ============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Configuration
BACKEND_PORT=5005
FRONTEND_PORT=8000
FINGERPRINT_DB="atepp_filtered_database.pkl"
SCORE_MAPPING="atepp_score_mapping.pkl"
ATEPP_PATH="ATEPP_JI_Dataset/ATEPP-1.2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Store backend PID for cleanup
BACKEND_PID=""

# Cleanup function - called on exit or Ctrl+C
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    
    # Kill backend server
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "  Stopping backend server (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null
        wait "$BACKEND_PID" 2>/dev/null
    fi
    
    # Kill any remaining processes on our ports
    pkill -f "two_stage_server.py" 2>/dev/null
    pkill -f "http.server $FRONTEND_PORT" 2>/dev/null
    
    echo -e "${GREEN}✓ All servers stopped${NC}"
    echo ""
    exit 0
}

# Set up trap to catch Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM EXIT

# Print header
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}       INSTANT HARMONIES - Just Intonation System${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check for required files
echo -e "${YELLOW}Checking dependencies...${NC}"

if [ ! -f "$FINGERPRINT_DB" ]; then
    echo -e "${RED}ERROR: Fingerprint database not found: $FINGERPRINT_DB${NC}"
    echo "Please run: python3 create_filtered_database.py"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Fingerprint database found"

if [ ! -f "$SCORE_MAPPING" ]; then
    echo -e "${RED}ERROR: Score mapping not found: $SCORE_MAPPING${NC}"
    echo "Please run: python3 create_filtered_database.py"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Score mapping found"

if [ ! -d "$ATEPP_PATH" ]; then
    echo -e "${RED}ERROR: ATEPP dataset not found at: $ATEPP_PATH${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} ATEPP dataset found"

if [ ! -f "index.html" ]; then
    echo -e "${RED}ERROR: index.html not found${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Frontend files found"

echo ""

# Kill any existing servers on our ports
echo -e "${YELLOW}Cleaning up any existing servers...${NC}"
pkill -f "two_stage_server.py" 2>/dev/null
pkill -f "http.server $FRONTEND_PORT" 2>/dev/null
sleep 1

# Start backend server (in background)
echo ""
echo -e "${YELLOW}Starting backend server on port $BACKEND_PORT...${NC}"
python3 two_stage_server.py \
    --fingerprint-db "$FINGERPRINT_DB" \
    --score-mapping "$SCORE_MAPPING" \
    --atepp-path "$ATEPP_PATH" \
    --port $BACKEND_PORT &
BACKEND_PID=$!

# Wait for backend to initialize
echo -e "  Waiting for backend to initialize..."
sleep 4

# Check if backend started successfully
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${RED}ERROR: Backend server failed to start${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Backend server running (PID: $BACKEND_PID)"

# Start frontend server (in foreground)
echo ""
echo -e "${YELLOW}Starting frontend server on port $FRONTEND_PORT...${NC}"
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}  ✓ System ready!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "  ${GREEN}→ Open your browser to: ${NC}${YELLOW}http://localhost:$FRONTEND_PORT${NC}"
echo ""
echo -e "  Backend (Two-Stage Server): http://localhost:$BACKEND_PORT"
echo -e "  Frontend (Web Interface):   http://localhost:$FRONTEND_PORT"
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "  Press ${RED}Ctrl+C${NC} to stop both servers"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Start frontend in foreground (this blocks until Ctrl+C)
python3 -m http.server $FRONTEND_PORT

# If we get here, frontend was stopped - cleanup will handle the rest

