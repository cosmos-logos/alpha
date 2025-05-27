curl -X POST http://localhost:3000/webhook/post-merge \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "alpha",
    "signingKey": "987CC775A58C0839"
  }'
