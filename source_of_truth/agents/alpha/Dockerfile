FROM node:18-alpine

WORKDIR /agent

COPY source_of_truth/package*.json ./
RUN npm install

COPY source_of_truth/ ./

ENV AGENT_ID=alpha

EXPOSE 3000
CMD ["npm", "start"]
