
const Footer = () => {
    return (
        <header className="teleshowFooter">
            <h1>TeleShow</h1>
            <p>Developed by Oguzhan Besiktepe, William Ackerman, Serena D'Avanzo, Moses Pierre, and Steave Marie Joseph</p>
            <h2>Contact</h2>
            <div className="contactTable">
                <div className="contact-item">
                    Oguzhan Besiktepe
                    <ul>
                        <li>
                            <a href="mailto:oguzhanbesiktepe@gmail.com" rel="noreferrer" target="_blank">
                                Email
                            </a><br />
                            <a href="https://github.com/OguzhanBesiktepe" rel="noreferrer" target="_blank">
                                GitHub
                            </a>
                            <br />
                            <a href="https://www.linkedin.com/in/oguzhan-besiktepe/" rel="noreferrer" target="_blank">
                                LinkedIn
                            </a>
                        </li>
                    </ul>
                </div>
                <div className="contact-item">
                    William Ackerman
                    <ul>
                        <li>
                            <a href="mailto:williamjohnackerman@gmail.com" rel="noreferrer" target="_blank">
                                Email
                            </a><br />
                            <a href="https://github.com/WilliamAckerman" rel="noreferrer" target="_blank">
                                GitHub
                            </a>
                            <br />
                            <a href="https://www.linkedin.com/in/william-ackerman-6a4005290/" rel="noreferrer" target="_blank">
                                LinkedIn
                            </a>
                        </li>
                    </ul>
                </div>

                <div className="contact-item">
                    Serena D'Avanzo
                    <li>
                        <a href="mailto:serenad9601@gmail.com" rel="noreferrer" target="_blank">
                            Email
                        </a><br />
                        <a href="https://github.com/Renabeth" rel="noreferrer" target="_blank">
                            GitHub
                        </a>
                        <br />
                        <a href="https://www.linkedin.com/in/serena-d-avanzo-5b3692201/" rel="noreferrer" target="_blank">
                            LinkedIn
                        </a>
                    </li>


                </div>
                <div className="contact-item">
                    Moses Pierre
                </div>
                <div className="contact-item">
                    Steave Marie Joseph
                </div>
            </div>
            <p>Credit to JustWatch as TMDB API watch providers data source.</p>
            <p>2025.</p>
        </header>
    )
}

export default Footer;