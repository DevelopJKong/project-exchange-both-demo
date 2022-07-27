import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Verification } from "../models/Verification.js";
import { config } from "../config.js";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

/** 이메일 관련 파리미터 및 함수 [시작] */
const emailConfig = {
    service: "gmail",
    host: "smtp.gmail.com",
    port: "587",
    secure: false,
    auth: {
        user: process.env.GOOGLE_MAIL,
        pass: process.env.GOOGLE_PASSWORD,
    },
};

const sendMailer = async (data) => {
    const transporter = nodemailer.createTransport(emailConfig);
    transporter.sendMail(data, (err, info) => {
        if (err) {
            console.log(err);
        } else {
            return info.response;
        }
    });
};

/** 이메일 관련 파리미터 및 함수 [끝]*/

export const getPage = (req, res) => {
    return res.send("hello");
};

export const postJoin = async (req, res) => {
    const { username, password, name, email, verified } = req.body;

    try {
        const exists = await User.findOne({ where: { email } });
        if (exists) {
            return res.status(409).json({ message: `해당 이메일이 존재 합니다` });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        // 신분증 인증,,계좌 1원 인증, 이메일 인증

        // 1.이메일 인증
        const codeNum = uuidv4();
        const mailVar = {
            form: `${process.env.GOOGLE_MAIL}`,
            to: email,
            subject: `${username}님 환영합니다!`,
            html: `
          <strong>Exchange project</strong>
          <br/>
          <hr/>
          <form method="post" action="http://localhost:5000/api/users/check">
            <p style="font-size:25px">로그인 버튼을 클릭해주세요</p>
            <input type="hidden" name="email" value=${email} />
            <input type="hidden" name="checkEmail" value=${codeNum} />
            <button style="color:#0984e3; font-size: 25px;">로그인</button>
          </form>
          <br/>
          <p>감사합니다</p>
          <p>&copy; ${new Date().getFullYear()} Exchange project</p>
          `,
        };

        const user = await User.create({
            username,
            password: hashPassword,
            name,
            email,
            verified,
        });

        await Verification.create({
            code: codeNum,
            user_id: user.id,
        });

        await sendMailer(mailVar);

        return res.status(201).json({ user });
    } catch (error) {
        console.log(error);
    }
};

export const postLogin = async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "이메일이나 비밀번호가 틀렸습니다" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ message: "이메일이나 비밀번호가 틀렸습니다" });
        }

        const token = jwt.sign({ id: user.id }, config.jwt.secretKey, {
            expiresIn: config.jwt.expiresInSec,
        });
        return res.status(200).json({ token, email });
    } catch (error) {
        console.log(error);
    }
};

export const postCheck = async (req, res) => {
    const { email, checkEmail } = req.body;
    const user = await User.findOne({ where: { email } });
    const verification = await Verification.findOne({ where: { user_id: user.id } });

    if (checkEmail === verification.code) {
        user.verified = true;
        await user.save();
    }
    return res.redirect("http://localhost:3000");
};
