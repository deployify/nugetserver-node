FROM node:16-alpine

COPY . .

ENV NODE_ENV production

RUN npm install

EXPOSE 5000

CMD ["npm", "run", "start"]
