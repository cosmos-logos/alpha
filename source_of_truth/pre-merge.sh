curl -X POST http://localhost:3000/webhook/pre-merge \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "alpha",
    "signingKey": "987CC775A58C0839",
    "repository": {
      "ssh_url": "git@github.com:cosmos-logos/alpha.git"
    }
  }'