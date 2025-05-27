curl -X POST http://localhost:3000/webhook/pre-merge \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "alpha",
    "signingKey": "B58C63840AA4D9B0"
  }'
